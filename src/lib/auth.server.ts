import { getRequest } from '@tanstack/react-start/server'

import { isLocale } from '#/paraglide/runtime'

import { auth } from './auth'
import { parseRoles } from './roles'
import type { SessionUser } from './session-types'

/**
 * Server-only session reader. Kept in its own `.server` module so the
 * better-auth and Prisma imports never reach a client bundle — the middleware
 * only touches this from inside `.server()` callbacks.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session) return null

  const user = session.user as typeof session.user & {
    status?: string | null
    role?: string | null
    banned?: boolean | null
    locale?: string | null
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: (user.status ?? 'PENDING') as SessionUser['status'],
    roles: parseRoles(user.role),
    banned: user.banned ?? false,
    locale: isLocale(user.locale) ? user.locale : null,
  }
}
