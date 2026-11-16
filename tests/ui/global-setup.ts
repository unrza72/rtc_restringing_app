import { execFileSync } from 'node:child_process'

import { E2E_SCHEMA, SERVER_ENV } from './env'

/**
 * Brings the `e2e` schema to a known state before a run: dropped and created
 * again, every migration applied (the same `prisma migrate deploy` a release
 * runs), then the seed (the bootstrap admin) and the string catalogue the
 * specs use. The schema exists only for these tests and is emptied every run.
 */
export default function globalSetup() {
  if (E2E_SCHEMA === 'public') {
    throw new Error('The UI tests empty their schema: give them ?schema=e2e')
  }
  const run = (command: string, args: Array<string>, input?: string) =>
    execFileSync('pnpm', ['exec', command, ...args], {
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
      input,
      env: { ...process.env, ...SERVER_ENV },
    })
  run(
    'prisma',
    ['db', 'execute', '--stdin'],
    `DROP SCHEMA IF EXISTS "${E2E_SCHEMA}" CASCADE; CREATE SCHEMA "${E2E_SCHEMA}";`,
  )
  run('prisma', ['migrate', 'deploy'])
  run('tsx', ['prisma/seed.ts'])
  run('tsx', ['tests/ui/seed-catalogue.ts'])
}
