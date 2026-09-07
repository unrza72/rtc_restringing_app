import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
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
