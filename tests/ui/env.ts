import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'dotenv'

/**
 * The UI tests run against their own server on their own port, backed by
 * their own schema (`e2e`) in the development database: a run never touches
 * the dev data in `public` or `pnpm dev` on :4000, and both can be up at the
 * same time. The connection comes from `.env`'s DATABASE_URL, or from
 * E2E_DATABASE_URL when set (e.g. a separate test database).
 */
export const PORT = 4100
export const BASE_URL = `http://localhost:${PORT}`
export const DATABASE_URL = e2eDatabaseUrl()

function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL
  const envFile = path.resolve(import.meta.dirname, '../../.env')
  const base = parse(readFileSync(envFile)).DATABASE_URL
  if (!base) throw new Error('Set DATABASE_URL in .env, or E2E_DATABASE_URL')
  const url = new URL(base)
  url.searchParams.set('schema', 'e2e')
  return url.toString()
}

/** The schema the tests own, emptied before every run. */
export const E2E_SCHEMA =
  new URL(DATABASE_URL).searchParams.get('schema') ?? 'public'

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
  RACKET_TOKENS_ENABLED: 'true',
  SEED_ADMIN_NAME: ADMIN.name,
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
}
