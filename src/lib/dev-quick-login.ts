import type { Role } from './roles'

/**
 * The fixed dev-only account roster for the "quick sign in" spike. Client-safe
 * by design — no passwords here, only what the login page needs to draw the
 * buttons. The credentials live in `dev-quick-login.server.ts`, reachable only
 * from server function handlers.
 *
 * Whether any of this is usable at all is still a server-only decision — see
 * `DEV_QUICK_LOGIN_ENABLED` in dev-quick-login.server.ts. This file only
 * describes what the roster *would* look like if it is.
 */

export const DEV_LOGIN_SLOTS = [
  'admin',
  'stringer-1',
  'stringer-2',
  'coach',
  'member-1',
  'member-2',
  'member-3',
] as const
export type DevLoginSlot = (typeof DEV_LOGIN_SLOTS)[number]

export type DevLoginRosterEntry = {
  slot: DevLoginSlot
  name: string
  email: string
  role: Role
}

export const DEV_LOGIN_ROSTER: ReadonlyArray<DevLoginRosterEntry> = [
  {
    slot: 'admin',
    name: 'Dev Admin',
    email: 'dev-admin@example.test',
    role: 'admin',
  },
  {
    slot: 'stringer-1',
    name: 'Dev Stringer 1',
    email: 'dev-stringer-1@example.test',
    role: 'operator',
  },
  {
    slot: 'stringer-2',
    name: 'Dev Stringer 2',
    email: 'dev-stringer-2@example.test',
    role: 'operator',
  },
  {
    slot: 'coach',
    name: 'Dev Coach',
    email: 'dev-coach@example.test',
    role: 'coach',
  },
  {
    slot: 'member-1',
    name: 'Dev Member 1',
    email: 'dev-member-1@example.test',
    role: 'member',
  },
  {
    slot: 'member-2',
    name: 'Dev Member 2',
    email: 'dev-member-2@example.test',
    role: 'member',
  },
  {
    slot: 'member-3',
    name: 'Dev Member 3',
    email: 'dev-member-3@example.test',
    role: 'member',
  },
]
