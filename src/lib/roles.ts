/**
 * Roles and account status. Kept free of server imports so routes and
 * components can use them on the client too.
 */

export const ROLES = [
  'member',
  'operator',
  'controller',
  'coach',
  'admin',
] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** Roles a role implies. Admins can do everything an operator can, and so on. */
const IMPLIES: Record<Role, Array<Role>> = {
  member: ['member'],
  operator: ['operator', 'member'],
  controller: ['controller', 'member'],
  coach: ['coach', 'member'],
  admin: ['admin', 'operator', 'controller', 'coach', 'member'],
}

/** better-auth stores roles as a comma-separated string. */
export function parseRoles(role: string | null | undefined): Array<Role> {
  const raw = (role ?? 'member')
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is Role => (ROLES as ReadonlyArray<string>).includes(r))

  const effective = new Set<Role>(['member'])
  for (const r of raw) for (const implied of IMPLIES[r]) effective.add(implied)
  return [...effective]
}

export function hasRole(role: string | null | undefined, required: Role) {
  return parseRoles(role).includes(required)
}

export function serializeRoles(roles: Array<Role>) {
  // Store only what was explicitly granted; `parseRoles` re-derives the rest.
  const explicit = ROLES.filter((r) => roles.includes(r))
  return (explicit.length ? explicit : ['member']).join(',')
}
