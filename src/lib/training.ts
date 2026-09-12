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

// ---------------------------------------------------------------------------
// timetable grid
// ---------------------------------------------------------------------------

/**
 * The window the timetable draws, and the size of one cell. Club training never
 * starts before eight or runs past ten, so a narrower grid keeps the cells big
 * enough to hit on a phone.
 */
export const GRID_START = 8 * 60
export const GRID_END = 22 * 60
export const GRID_STEP = 30

export type Slot = { weekday: number; startMin: number; endMin: number }

export const gridRowStarts = () => {
  const rows: Array<number> = []
  for (let t = GRID_START; t + GRID_STEP <= GRID_END; t += GRID_STEP)
    rows.push(t)
  return rows
}

export const cellKey = (weekday: number, startMin: number) =>
  `${weekday}:${startMin}`

/**
 * Slots → the cells the grid should fill. Only cells lying *entirely* inside a
 * slot count: rounding outwards would claim time the person never offered, and
 * the planner would then schedule sessions they cannot attend.
 */
export function cellsFromSlots(slots: Array<Slot>): Set<string> {
  const cells = new Set<string>()
  for (const slot of slots) {
    const first =
      Math.ceil(Math.max(slot.startMin, GRID_START) / GRID_STEP) * GRID_STEP
    const limit = Math.min(slot.endMin, GRID_END)
    for (let t = first; t + GRID_STEP <= limit; t += GRID_STEP) {
      cells.add(cellKey(slot.weekday, t))
    }
  }
  return cells
}

/** Cells → the fewest slots that describe them, merging touching cells. */
export function slotsFromCells(cells: Set<string>): Array<Slot> {
  const byDay = new Map<number, Array<number>>()
  for (const key of cells) {
    const [day, start] = key.split(':').map(Number)
    const starts = byDay.get(day) ?? []
    starts.push(start)
    byDay.set(day, starts)
  }

  const slots: Array<Slot> = []
  for (const [weekday, starts] of [...byDay].sort((a, b) => a[0] - b[0])) {
    starts.sort((a, b) => a - b)
    let runStart = starts[0]
    let runEnd = starts[0] + GRID_STEP
    for (const start of starts.slice(1)) {
      if (start === runEnd) {
        runEnd = start + GRID_STEP
      } else {
        slots.push({ weekday, startMin: runStart, endMin: runEnd })
        runStart = start
        runEnd = start + GRID_STEP
      }
    }
    slots.push({ weekday, startMin: runStart, endMin: runEnd })
  }
  return slots
}

export const slotSignature = (slots: Array<Slot>) =>
  slots
    .map((s) => `${s.weekday}:${s.startMin}-${s.endMin}`)
    .sort()
    .join('|')

/**
 * True when the grid can express these slots exactly. Anything off the step —
 * 17:10, or a time outside the drawn window — would be quietly narrowed on the
 * next save, so the UI warns instead of silently editing it away.
 */
export function fitsGrid(slots: Array<Slot>) {
  return (
    slotSignature(slotsFromCells(cellsFromSlots(slots))) ===
    slotSignature(slots)
  )
}

/** Carried over from the status badges: one colour per ball, dark-friendly. */
export const BALL_BADGE: Record<Ball, string> = {
  RED: 'bg-rose-950 text-rose-200 border-rose-700',
  ORANGE: 'bg-orange-950 text-orange-200 border-orange-700',
  GREEN: 'bg-emerald-950 text-emerald-200 border-emerald-600',
  YELLOW: 'bg-yellow-950 text-yellow-100 border-yellow-600',
}
