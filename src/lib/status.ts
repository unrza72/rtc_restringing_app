/**
 * The restringing request lifecycle. Client-safe: the queue UI and the server
 * functions both decide what is allowed from this one table.
 */

export const REQUEST_STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'DONE',
  'COLLECTED',
  'CANCELLED',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const STRING_SOURCES = ['CLUB', 'MEMBER'] as const
export type StringSource = (typeof STRING_SOURCES)[number]

export type RequestAction =
  'accept' | 'release' | 'complete' | 'collect' | 'cancel'

/** Who may fire an action, and where it lands. */
const TRANSITIONS: Record<
  RequestAction,
  { from: Array<RequestStatus>; to: RequestStatus }
> = {
  accept: { from: ['REQUESTED'], to: 'ACCEPTED' },
  release: { from: ['ACCEPTED'], to: 'REQUESTED' },
  complete: { from: ['ACCEPTED'], to: 'DONE' },
  collect: { from: ['DONE'], to: 'COLLECTED' },
  cancel: { from: ['REQUESTED', 'ACCEPTED'], to: 'CANCELLED' },
}

export function canTransition(from: string, action: RequestAction) {
  return TRANSITIONS[action].from.includes(from as RequestStatus)
}

export function nextStatus(action: RequestAction): RequestStatus {
  return TRANSITIONS[action].to
}

/** Statuses that still need someone to do something. */
export const OPEN_STATUSES: Array<RequestStatus> = [
  'REQUESTED',
  'ACCEPTED',
  'DONE',
]

export function isOpen(status: string) {
  return OPEN_STATUSES.includes(status as RequestStatus)
}

/**
 * Badge colouring, shared by every list and detail view, from the club palette
 * (misc/BRAND.md): court green for "nothing is happening yet", terracotta while
 * it is on the machine, sage once it can be picked up, crown red for cancelled.
 *
 * Tinted fills with a dark text colour — on cream, a solid colour block shouts
 * far louder than the status deserves.
 */
export const STATUS_BADGE: Record<RequestStatus, string> = {
  REQUESTED: 'bg-court-100 text-court-900 border-court-200',
  ACCEPTED: 'bg-terracotta-50 text-terracotta-800 border-terracotta-200',
  DONE: 'bg-sage-100 text-sage-800 border-sage-300',
  COLLECTED: 'bg-background text-sage-700 border-sage-200',
  CANCELLED: 'bg-terracotta-100 text-crown border-terracotta-300',
}
