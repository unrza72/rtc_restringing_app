import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'

// Served over HTTPS (production), every auth cookie is named `__Host-…`: the
// browser then insists on Secure, Path=/ and no Domain, so a sibling subdomain
// can't plant or overwrite a session. better-auth only knows the weaker
// `__Secure-` prefix, so its own prefixing is off and the name and flags are
// set here. SameSite stays Lax, not Strict: Strict would drop the session on
// every link opened from WhatsApp or email, and cross-site POSTs are already
// refused by Lax plus better-auth's origin check. Plain-HTTP dev keeps the
// defaults, since browsers reject `__Host-` cookies without HTTPS.
const servedOverHttps =
  process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false

const hardenedCookies = {
  useSecureCookies: false,
  cookiePrefix: '__Host-rtc',
  defaultCookieAttributes: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  },
} as const

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // On in production (better-auth's default), counted per client IP in
  // memory — enough for the single pm2 process, and a restart only forgets
  // the counts. Everything not listed keeps better-auth's limits: 3 per 10s
  // for change-password, 100 per 10s for the rest.
  rateLimit: {
    customRules: {
      // Password guessing: about 7,000 tries a day per IP instead of 26,000.
      // Counts successful sign-ins too, and the clubhouse WiFi shares one IP,
      // but with week-long sessions few members sign in at the same moment.
      '/sign-in/email': { window: 60, max: 5 },
      // Signing up needs an invite anyway; this just caps the noise, while
      // leaving room for a few newcomers joining on the clubhouse WiFi.
      '/sign-up/email': { window: 600, max: 10 },
    },
  },
  advanced: {
    // The app sits behind a reverse proxy on the same machine, which appends
    // the visitor's address to X-Forwarded-For. Reading the header from the
    // right and skipping our own proxy gives that address; anything a client
    // wrote into the header itself sits further left and is ignored.
    ipAddress: { trustedProxies: ['127.0.0.1', '::1'] },
    ...(servedOverHttps ? hardenedCookies : {}),
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // PENDING | APPROVED | REJECTED — new members must be approved by an admin
      status: {
        type: 'string',
        required: false,
        defaultValue: 'PENDING',
        input: false,
      },
      approvedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      approvedById: {
        type: 'string',
        required: false,
        input: false,
      },
      // "en" | "de" — set only via our own server functions (setMyLocale /
      // recordInitialLocale), never through better-auth's own update-user route.
      locale: {
        type: 'string',
        required: false,
        input: false,
      },
      // Set by completeOnboarding once the welcome tour has been seen.
      onboardedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      // The invite this account was created with. `input: true` so
      // signUp.email({ ..., inviteToken }) type-checks; `required: false` so a
      // missing/bad token surfaces our own message below rather than a bare
      // schema-validation error.
      inviteToken: {
        type: 'string',
        required: false,
        input: true,
      },
    },
    // Gates who can create an account. Fails closed — a thrown error or a
    // returned `{ error }` both reject; only a plain return allows.
    //
    // Runs *inside* createUser, before the user/account rows are inserted
    // (verified against node_modules/better-auth/dist/db/internal-adapter.mjs),
    // so a rejection here means nothing was ever written — no half-created
    // account to clean up.
    validateUserInfo: async ({ user, source }) => {
      if (
        source.action !== 'create-user' ||
        source.method !== 'email-password'
      ) {
        return
      }

      const token =
        typeof user.inviteToken === 'string' ? user.inviteToken : null
      if (!token) {
        return {
          error: 'invite_required',
          errorDescription: 'An invite link is required to sign up.',
        }
      }

      // Atomically claim the invite: the `usedAt: null` guard means two
      // concurrent signups on the same link can't both pass this check, since
      // only the first `updateMany` actually matches a row.
      const claimed = await prisma.invite.updateMany({
        where: {
          token,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      })
      if (claimed.count === 0) {
        return {
          error: 'invite_invalid',
          errorDescription: 'This invite link is invalid, used, or expired.',
        }
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // By now the invite is already claimed (validateUserInfo ran first,
        // in the same request) and the user row is committed, so this only
        // needs to record *who* redeemed it.
        async after(user) {
          const token =
            typeof user.inviteToken === 'string' ? user.inviteToken : null
          if (!token) return
          await prisma.invite.update({
            where: { token },
            data: { usedById: user.id },
          })
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: 'member', adminRoles: ['admin'] }),
    tanstackStartCookies(),
  ],
})
