import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import { DATABASE_URL, SERVER_ENV } from './env'

/**
 * Brings `e2e.sqlite` to a known state before a run: every table dropped, the
 * schema pushed from scratch, then the seed (the bootstrap admin) and the
 * string catalogue the specs use.
 *
 * Dropping the tables rather than migrating them means a schema change never
 * meets existing rows or columns, so `db push` never stops to ask about data
 * loss (it would, for example, on any new unique constraint). This database
 * exists only for these tests and is emptied every run regardless.
 *
 * The file itself stays: in `--ui` mode the server is already running and keeps
 * its handle open, and a replaced file would leave it reading the old one.
 */
export default function globalSetup() {
  const db = new DatabaseSync(fileURLToPath(DATABASE_URL))
  db.exec('PRAGMA foreign_keys = OFF')
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>
  for (const { name } of tables) db.exec(`DROP TABLE "${name}"`)
  db.close()

  const run = (command: string, args: Array<string>) =>
    execFileSync('pnpm', ['exec', command, ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...SERVER_ENV },
    })
  run('prisma', ['db', 'push'])
  run('tsx', ['prisma/seed.ts'])
  run('tsx', ['tests/ui/seed-catalogue.ts'])
}
