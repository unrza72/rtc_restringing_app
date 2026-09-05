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
 * Badge colouring, shared by every list and detail view. Carried over from the
 * prototype: slate for "nothing is happening yet", amber while it is on the
 * machine, emerald once it can be picked up, rose for cancelled.
 */
export const STATUS_BADGE: Record<RequestStatus, string> = {
  REQUESTED: 'bg-slate-800 text-slate-300 border-slate-700',
  ACCEPTED: 'bg-amber-950 text-amber-200 border-amber-600',
  DONE: 'bg-emerald-950 text-emerald-200 border-emerald-500',
  COLLECTED: 'bg-slate-800/60 text-slate-400 border-slate-700',
  CANCELLED: 'bg-rose-950 text-rose-300 border-rose-800',
}
