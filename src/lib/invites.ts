/**
 * Pure invite-status logic, shared between the public pre-flight check on
 * /signup and the admin/stringer-facing list. The real enforcement — the
 * atomic claim that actually blocks a second use — lives in
 * `src/lib/auth.ts`'s `validateUserInfo`; this is display-only.
 */

export type InviteFields = {
  usedAt: Date | string | null
  revokedAt: Date | string | null
  expiresAt: Date | string
}

export function isInviteActive(invite: InviteFields) {
  return (
    !invite.usedAt &&
    !invite.revokedAt &&
    new Date(invite.expiresAt).getTime() > Date.now()
  )
}

export type InviteStatus = 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED'

export function inviteStatus(invite: InviteFields): InviteStatus {
  if (invite.usedAt) return 'USED'
  if (invite.revokedAt) return 'REVOKED'
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return 'EXPIRED'
  return 'ACTIVE'
}
