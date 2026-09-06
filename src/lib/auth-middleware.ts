import { createMiddleware } from '@tanstack/react-start'

import { AuthError } from './session-types'
import type { Role } from './roles'

/**
 * The security boundary for every server function. Route guards are UX only —
 * server functions are reachable as plain RPC endpoints, so each one that
 * touches private data must run through these.
 *
 * The session lookup is imported inside the `.server()` bodies so the Prisma
 * and better-auth code is stripped from the client bundle.
 */

/** Signed in — but not necessarily approved. Only `/pending` should use this. */
export const authedMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const { getSessionUser } = await import('./auth.server')
    const user = await getSessionUser()
    if (!user) throw new AuthError('Not signed in', 'UNAUTHENTICATED')
    if (user.banned) throw new AuthError('Account disabled', 'FORBIDDEN')
    return next({ context: { user } })
  },
)

/** Signed in and approved by an admin. The default for app server functions. */
export const memberMiddleware = createMiddleware({ type: 'function' })
  .middleware([authedMiddleware])
  .server(async ({ next, context }) => {
    if (context.user.status !== 'APPROVED') {
      throw new AuthError('Account awaiting approval', 'NOT_APPROVED')
    }
    return next({ context: { user: context.user } })
  })

function requireRole(role: Role) {
  return createMiddleware({ type: 'function' })
    .middleware([memberMiddleware])
    .server(async ({ next, context }) => {
      if (!context.user.roles.includes(role)) {
        throw new AuthError(`Requires the ${role} role`, 'FORBIDDEN')
      }
      return next({ context: { user: context.user } })
    })
}

/** Any one of these roles is enough — used where two specialties overlap. */
function requireAnyRole(...roles: Array<Role>) {
  return createMiddleware({ type: 'function' })
    .middleware([memberMiddleware])
    .server(async ({ next, context }) => {
      if (!roles.some((role) => context.user.roles.includes(role))) {
        throw new AuthError(`Requires one of: ${roles.join(', ')}`, 'FORBIDDEN')
      }
      return next({ context: { user: context.user } })
    })
}

export const operatorMiddleware = requireRole('operator')
export const controllerMiddleware = requireRole('controller')
export const adminMiddleware = requireRole('admin')

/**
 * The billing view: a stringer needs to see prices to know what to charge,
 * a controller needs to see them to reconcile payments. Admin gets in either
 * way, via the role cascade.
 */
export const billingViewMiddleware = requireAnyRole('operator', 'controller')
