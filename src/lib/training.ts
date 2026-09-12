/**
 * Client-safe bits of the training planner. The solver's own vocabulary lives
 * in `#/solver/types` and is re-exported here so the UI and the solver cannot
 * drift apart on what a ball or a weekday is.
 */

import { BALLS } from '#/solver/types'
import type { Ball } from '#/solver/types'

export { BALLS }
export type { Ball }

export const PERSON_KINDS = ['TRAINEE', 'TRAINER'] as const
export type PersonKind = (typeof PERSON_KINDS)[number]

/** 0 = Monday … 6 = Sunday, matching the solver. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export const MIN_STRENGTH = 0
export const MAX_STRENGTH = 5

/** Minutes from midnight → "17:30". */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "17:30" → minutes from midnight, or null if it is not a time. */
export function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

export function formatSlot(startMin: number, endMin: number) {
  return `${formatMinutes(startMin)}–${formatMinutes(endMin)}`
}

/** Carried over from the status badges: one colour per ball, dark-friendly. */
export const BALL_BADGE: Record<Ball, string> = {
  RED: 'bg-rose-950 text-rose-200 border-rose-700',
  ORANGE: 'bg-orange-950 text-orange-200 border-orange-700',
  GREEN: 'bg-emerald-950 text-emerald-200 border-emerald-600',
  YELLOW: 'bg-yellow-950 text-yellow-100 border-yellow-600',
}
