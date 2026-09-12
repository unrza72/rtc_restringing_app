import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

import type { RequestStatus } from './status'
import type { Role, UserStatus } from './roles'

/**
 * Paraglide compiles one function per message, so enum-ish values need an
 * explicit map — that also makes a missing translation a type error.
 */

const REQUEST_STATUS_LABELS: Record<RequestStatus, () => string> = {
  REQUESTED: m.status_REQUESTED,
  ACCEPTED: m.status_ACCEPTED,
  DONE: m.status_DONE,
  COLLECTED: m.status_COLLECTED,
  CANCELLED: m.status_CANCELLED,
}

export function requestStatusLabel(status: string) {
  // Fall back to the raw value if the database ever holds a status we retired.
  return status in REQUEST_STATUS_LABELS
    ? REQUEST_STATUS_LABELS[status as RequestStatus]()
    : status
}

const USER_STATUS_LABELS: Record<UserStatus, () => string> = {
  PENDING: m.member_status_PENDING,
  APPROVED: m.member_status_APPROVED,
  REJECTED: m.member_status_REJECTED,
}

export function userStatusLabel(status: string) {
  return status in USER_STATUS_LABELS
    ? USER_STATUS_LABELS[status as UserStatus]()
    : status
}

const ROLE_LABELS: Record<Role, () => string> = {
  member: m.role_member,
  operator: m.role_operator,
  controller: m.role_controller,
  coach: m.role_coach,
  admin: m.role_admin,
}

export function roleLabel(role: Role) {
  return ROLE_LABELS[role]()
}

// --- formatting ------------------------------------------------------------

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return m.common_none()
  return new Intl.DateTimeFormat(getLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return m.common_none()
  return new Intl.DateTimeFormat(getLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatPrice(cents: number | null | undefined) {
  if (cents == null) return m.common_none()
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/** String + labour, or null when neither was ever entered. */
export function totalPriceCents(
  stringPriceCents: number | null,
  labourPriceCents: number | null,
) {
  if (stringPriceCents == null && labourPriceCents == null) return null
  return (stringPriceCents ?? 0) + (labourPriceCents ?? 0)
}

/** "24 / 23 kg", or just "24 kg" when the crosses match the mains. */
export function formatTension(main: number, cross: number | null | undefined) {
  return cross == null || cross === main
    ? `${main} kg`
    : `${main} / ${cross} kg`
}

/** What the member asked to be strung: a catalogue entry or their own string. */
export function describeString(request: {
  stringSource: string
  ownStringName: string | null
  clubString: { name: string; gauge: string | null } | null
}) {
  if (request.stringSource === 'CLUB' && request.clubString) {
    return [request.clubString.name, request.clubString.gauge]
      .filter(Boolean)
      .join(' ')
  }
  return request.ownStringName ?? m.common_none()
}
