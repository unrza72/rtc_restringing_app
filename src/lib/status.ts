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
 * Badge colouring, shared by every list and detail view: slate for "nothing is
 * happening yet", amber while it is on the machine, emerald once it can be
 * picked up, rose for cancelled.
 *
 * Tinted fills with a saturated text colour, rather than the saturated fills a
 * dark surface wanted — on white, a solid colour block shouts far louder than
 * the status deserves.
 */
export const STATUS_BADGE: Record<RequestStatus, string> = {
  REQUESTED: 'bg-slate-100 text-slate-700 border-slate-300',
  ACCEPTED: 'bg-amber-50 text-amber-800 border-amber-300',
  DONE: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  COLLECTED: 'bg-slate-50 text-slate-500 border-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-300',
}
