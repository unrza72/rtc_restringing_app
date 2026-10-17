import path from 'node:path'

/**
 * The UI tests run against their own server on their own port, backed by their
 * own SQLite file — a run never touches `pnpm dev` on :4000 or `dev.sqlite`,
 * and both can be up at the same time.
 */
export const PORT = 4100
export const BASE_URL = `http://localhost:${PORT}`
export const DATABASE_URL = `file://${path.resolve(import.meta.dirname, '../../e2e.sqlite')}`

export const ADMIN = {
  name: 'E2E Admin',
  email: 'admin@e2e.test',
  password: 'e2e-admin-password',
}

/**
 * Handed to the dev server and to the seed/reset scripts. Explicit variables
 * win over `.env` — dotenv never overrides what is already set — so these
 * redirect everything at the e2e database without touching `.env` itself.
 *
 * `BETTER_AUTH_URL` has to follow the port: better-auth only trusts requests
 * from that origin, and sign-in from :4100 would be refused as cross-site.
 * Quick-login stays off so `/login` looks the way it does for real members.
 */
export const SERVER_ENV = {
  DATABASE_URL,
  BETTER_AUTH_URL: BASE_URL,
  DEV_QUICK_LOGIN_ENABLED: 'false',
  SEED_ADMIN_NAME: ADMIN.name,
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
}
