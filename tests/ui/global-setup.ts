import { execFileSync } from 'node:child_process'

import { SERVER_ENV } from './env'

/**
 * Brings `e2e.sqlite` to a known state before a run: schema pushed, every row
 * wiped, then the seed — the bootstrap admin plus the club string catalogue.
 *
 * Rows are deleted rather than the file being replaced, because in `--ui` mode
 * the dev server stays up between runs and keeps its database handle open; a
 * fresh file would leave it reading the old, unlinked one.
 */
export default function globalSetup() {
  const run = (command: string, args: Array<string>) =>
    execFileSync('pnpm', ['exec', command, ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...SERVER_ENV },
    })

  // Empty the tables before pushing the schema, so a schema change never has
  // data to lose and a plain `db push` goes through without
  // `--accept-data-loss` — which Prisma refuses to run unattended. On a first
  // run, or after a new model, some tables don't exist yet; the wipe after the
  // push catches those.
  try {
    run('tsx', ['scripts/reset-dev-data.ts'])
  } catch {
    console.log('↷ nothing to wipe before the schema push')
  }
  run('prisma', ['db', 'push'])
  run('tsx', ['scripts/reset-dev-data.ts'])
  run('tsx', ['prisma/seed.ts'])
}
