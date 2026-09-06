/**
 * Server-only half of the dev quick-login spike. Import this ONLY from inside
 * a server function's `.handler()` body (or from `prisma/seed.ts`, which never
 * ships to a browser) — never from a route component or anything else a
 * client bundle can reach, since `DEV_QUICK_LOGIN_PASSWORD` lives here.
 *
 * Off by default. Must be explicitly enabled per environment:
 *   DEV_QUICK_LOGIN_ENABLED=true
 * Never set this in a real deployment — it hands out working sessions for six
 * known, fixed-password accounts to anyone who can reach the login page.
 */

export function isDevQuickLoginEnabled() {
  return process.env.DEV_QUICK_LOGIN_ENABLED === 'true'
}

const DEFAULT_DEV_PASSWORD = 'devpassword123'

export function devQuickLoginPassword() {
  return process.env.DEV_QUICK_LOGIN_PASSWORD || DEFAULT_DEV_PASSWORD
}
