import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { auth } from '#/lib/auth'
import { DEV_LOGIN_ROSTER, DEV_LOGIN_SLOTS } from '#/lib/dev-quick-login'
import {
  devQuickLoginPassword,
  isDevQuickLoginEnabled,
} from '#/lib/dev-quick-login.server'

/**
 * Spike devtools: sign in as one of a fixed roster of six seeded accounts
 * without typing a password. Gated end-to-end by `DEV_QUICK_LOGIN_ENABLED` —
 * the login page only renders the buttons when this list comes back non-empty,
 * but `devQuickSignIn` re-checks the flag itself, since a hidden button is a
 * UI nicety, not a security boundary. See dev-quick-login.server.ts.
 */

export const getDevQuickLoginUsers = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!isDevQuickLoginEnabled()) return []
    return DEV_LOGIN_ROSTER.map(({ slot, name, role }) => ({
      slot,
      name,
      role,
    }))
  },
)

export const devQuickSignIn = createServerFn({ method: 'POST' })
  .validator(z.object({ slot: z.enum(DEV_LOGIN_SLOTS) }))
  .handler(async ({ data }) => {
    if (!isDevQuickLoginEnabled()) {
      throw new Error('Dev quick login is disabled')
    }
    const entry = DEV_LOGIN_ROSTER.find((u) => u.slot === data.slot)
    if (!entry) throw new Error('Unknown dev login account')

    try {
      // Sets the session cookie as a side effect via the tanstackStartCookies
      // plugin, exactly as if this had come in through /api/auth/sign-in/email.
      await auth.api.signInEmail({
        body: { email: entry.email, password: devQuickLoginPassword() },
      })
    } catch {
      throw new Error(
        `Could not sign in as ${entry.name} — run "pnpm db:seed" with DEV_QUICK_LOGIN_ENABLED=true first`,
      )
    }

    return { ok: true }
  })
