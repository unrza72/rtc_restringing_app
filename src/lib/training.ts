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

/** The size of one cell. Everything else about the window is configurable. */
export const GRID_STEP = 30

export const MINUTES_PER_DAY = 24 * 60

export type Slot = { weekday: number; startMin: number; endMin: number }

/** The span of day the timetable draws. Narrower keeps cells big on a phone. */
export type GridWindow = { startMin: number; endMin: number }

export const DEFAULT_GRID_WINDOW: GridWindow = {
  startMin: 8 * 60,
  endMin: 22 * 60,
}

/**
 * Pulls a window onto the step and guarantees at least one row, so a half-typed
 * time in the picker can never produce an empty or upside-down grid. The start
 * rounds down and the end rounds up, widening rather than hiding anything.
 */
export function normaliseWindow(window: GridWindow): GridWindow {
  const startMin = Math.min(
    Math.max(0, Math.floor(window.startMin / GRID_STEP) * GRID_STEP),
    MINUTES_PER_DAY - GRID_STEP,
  )
  const endMin = Math.min(
    Math.max(
      Math.ceil(window.endMin / GRID_STEP) * GRID_STEP,
      startMin + GRID_STEP,
    ),
    MINUTES_PER_DAY,
  )
  return { startMin, endMin }
}

export function gridRowStarts(window: GridWindow) {
  const { startMin, endMin } = normaliseWindow(window)
  const rows: Array<number> = []
  for (let t = startMin; t + GRID_STEP <= endMin; t += GRID_STEP) rows.push(t)
  return rows
}

export const cellKey = (weekday: number, startMin: number) =>
  `${weekday}:${startMin}`

/**
 * Slots → the cells the grid should fill. Only cells lying *entirely* inside a
 * slot count: rounding outwards would claim time the person never offered, and
 * the planner would then schedule sessions they cannot attend.
 */
export function cellsFromSlots(
  slots: Array<Slot>,
  window: GridWindow,
): Set<string> {
  const { startMin, endMin } = normaliseWindow(window)
  const cells = new Set<string>()
  for (const slot of slots) {
    const first =
      Math.ceil(Math.max(slot.startMin, startMin) / GRID_STEP) * GRID_STEP
    const limit = Math.min(slot.endMin, endMin)
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
export function fitsGrid(slots: Array<Slot>, window: GridWindow) {
  return (
    slotSignature(slotsFromCells(cellsFromSlots(slots, window))) ===
    slotSignature(slots)
  )
}

/**
 * The parts of these slots lying outside the window, clipped to it.
 *
 * The grid only owns the hours it draws. Without this, narrowing the window and
 * then painting would silently delete a Saturday morning nobody could even see —
 * the save replaces the whole week, so what the grid does not hand back is gone.
 */
export function slotsOutsideWindow(
  slots: Array<Slot>,
  window: GridWindow,
): Array<Slot> {
  const { startMin, endMin } = normaliseWindow(window)
  const outside: Array<Slot> = []
  for (const slot of slots) {
    if (slot.startMin < startMin) {
      outside.push({
        weekday: slot.weekday,
        startMin: slot.startMin,
        endMin: Math.min(slot.endMin, startMin),
      })
    }
    if (slot.endMin > endMin) {
      outside.push({
        weekday: slot.weekday,
        startMin: Math.max(slot.startMin, endMin),
        endMin: slot.endMin,
      })
    }
  }
  return outside.filter((s) => s.endMin > s.startMin)
}

/**
 * Spreads overlapping items across side-by-side lanes, the way a calendar puts
 * two simultaneous meetings next to each other. Greedy and deterministic: each
 * item takes the lowest lane that is free when it starts.
 */
export function assignLanes<T extends { startMin: number; endMin: number }>(
  items: Array<T>,
): { items: Array<T & { lane: number }>; laneCount: number } {
  const laneEnds: Array<number> = []
  const placed: Array<T & { lane: number }> = []

  for (const item of [...items].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  )) {
    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[lane] = item.endMin
    }
    placed.push({ ...item, lane })
  }

  return { items: placed, laneCount: Math.max(1, laneEnds.length) }
}

/** The tightest window that still shows every one of these slots whole. */
export function windowCovering(
  slots: Array<Slot>,
  fallback: GridWindow,
): GridWindow {
  if (slots.length === 0) return normaliseWindow(fallback)
  return normaliseWindow({
    startMin: Math.min(fallback.startMin, ...slots.map((s) => s.startMin)),
    endMin: Math.max(fallback.endMin, ...slots.map((s) => s.endMin)),
  })
}

/** Carried over from the status badges: one colour per ball, dark-friendly. */
export const BALL_BADGE: Record<Ball, string> = {
  RED: 'bg-rose-950 text-rose-200 border-rose-700',
  ORANGE: 'bg-orange-950 text-orange-200 border-orange-700',
  GREEN: 'bg-emerald-950 text-emerald-200 border-emerald-600',
  YELLOW: 'bg-yellow-950 text-yellow-100 border-yellow-600',
}
