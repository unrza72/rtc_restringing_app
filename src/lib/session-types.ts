import type { Locale } from '#/paraglide/runtime'

import type { Role, UserStatus } from './roles'

/** The session shape the whole app works with. Client-safe. */
export type SessionUser = {
  id: string
  name: string
  email: string
  status: UserStatus
  roles: Array<Role>
  banned: boolean
  /** null if never recorded — see recordInitialLocale. */
  locale: Locale | null
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAUTHENTICATED' | 'NOT_APPROVED' | 'FORBIDDEN',
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
