import { redirect } from '@tanstack/react-router'

import type { Role } from './roles'
import type { SessionUser } from './session-types'

/**
 * Route-level guards. These are UX only — they keep people out of screens that
 * would break for them. The real enforcement lives in the server function
 * middleware in `auth-middleware.ts`.
 */

/** Signed in and approved, or redirected away. Returns the narrowed user. */
export function requireApproved(
  user: SessionUser | null,
  href: string,
): SessionUser {
  if (!user) throw redirect({ to: '/login', search: { redirect: href } })
  if (user.status !== 'APPROVED') throw redirect({ to: '/pending' })
  return user
}

export function requireRole(
  user: SessionUser | null,
  role: Role,
  href: string,
): SessionUser {
  const approved = requireApproved(user, href)
  if (!approved.roles.includes(role)) throw redirect({ to: '/dashboard' })
  return approved
}

/** Any one of `roles` is enough — used where two specialties overlap. */
export function requireAnyRole(
  user: SessionUser | null,
  roles: Array<Role>,
  href: string,
): SessionUser {
  const approved = requireApproved(user, href)
  if (!roles.some((role) => approved.roles.includes(role))) {
    throw redirect({ to: '/dashboard' })
  }
  return approved
}
