import { BALLS } from './types'
import type {
  Ball,
  SolveInput,
  SolveOptions,
  SolveResult,
  SolvedGroup,
  Slot,
  Trainee,
  Unplaced,
} from './types'

/**
 * Assigns trainees to trainers and time slots.
 *
 * The strategy is a greedy one: repeatedly find the single best group that can
 * still be formed anywhere in the week, commit it, and repeat until nothing
 * reaches the minimum size. "Best" means the largest group, then the tightest
 * strength spread, then the earliest slot. That is not guaranteed optimal — a
 * big group taken early can strand players who would have fitted elsewhere —
 * but it is fast, explainable, and stable: the same input always produces the
 * same plan, which matters when a coach re-runs it after a small edit.
 *
 * Hard rules, none of which the result may violate:
 *   - everyone in a group shares a ball type
 *   - the strength spread inside a group is within `strengthSpread`
 *   - group size is between `minGroupSize` and `maxGroupSize`
 *   - trainer and every trainee are free for the whole session
 *   - a trainer runs at most one group at a time
 *   - at most `courtCount` groups overlap at any moment
 *   - a trainee is placed at most once
 */
export function solve(input: SolveInput): SolveResult {
  const options = validate(input.options)
  const trainees = [...input.trainees].sort(byId)
  const candidates = buildCandidates(input.trainers, options)

  const groups: Array<SolvedGroup> = []
  const placed = new Set<string>()

  for (;;) {
    const pool = trainees.filter((t) => !placed.has(t.id))
    if (pool.length < options.minGroupSize) break

    let best: { candidate: Candidate; pick: Pick; court: number } | null = null
    for (const candidate of candidates) {
      if (trainerBusy(groups, candidate)) continue
      const court = freeCourt(groups, candidate, options.courtCount)
      if (court === null) continue

      const pick = bestGroupAt(candidate, pool, options)
      // Strictly better only, so ties fall to the earlier candidate and the
      // whole run stays reproducible.
      if (pick && (!best || isBetter(pick, best.pick))) {
        best = { candidate, pick, court }
      }
    }
    if (!best) break

    groups.push({
      trainerId: best.candidate.trainerId,
      weekday: best.candidate.weekday,
      startMin: best.candidate.startMin,
      endMin: best.candidate.endMin,
      ball: best.pick.ball,
      court: best.court,
      traineeIds: best.pick.traineeIds,
    })
    for (const id of best.pick.traineeIds) placed.add(id)
  }

  const unplaced: Array<Unplaced> = trainees
    .filter((t) => !placed.has(t.id))
    .map((trainee) => ({
      traineeId: trainee.id,
      reason: whyUnplaced(trainee, candidates),
    }))

  groups.sort(
    (a, b) =>
      a.weekday - b.weekday || a.startMin - b.startMin || a.court - b.court,
  )
  return { groups, unplaced }
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

type Candidate = {
  trainerId: string
  weekday: number
  startMin: number
  endMin: number
}

/** A group that could be formed in one candidate slot. */
type Pick = { ball: Ball; spread: number; traineeIds: Array<string> }

function validate(options: SolveOptions): SolveOptions {
  const problems: Array<string> = []
  if (options.minGroupSize < 1) problems.push('minGroupSize must be at least 1')
  if (options.maxGroupSize < options.minGroupSize) {
    problems.push('maxGroupSize must be at least minGroupSize')
  }
  if (options.strengthSpread < 0) problems.push('strengthSpread must be >= 0')
  if (options.sessionMinutes < 1) problems.push('sessionMinutes must be >= 1')
  if (options.slotStepMinutes < 1) problems.push('slotStepMinutes must be >= 1')
  if (options.courtCount < 1) problems.push('courtCount must be at least 1')
  if (problems.length) throw new Error(problems.join('; '))
  return options
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

/** Is someone free for the whole window, within a single availability slot? */
function covers(
  slots: Array<Slot>,
  weekday: number,
  startMin: number,
  endMin: number,
) {
  return slots.some(
    (s) =>
      s.weekday === weekday && s.startMin <= startMin && s.endMin >= endMin,
  )
}

/**
 * Every (trainer, weekday, start) a session could begin at. Starts sit on the
 * absolute grid from midnight, so a 30-minute step means :00 and :30 even when
 * a trainer's availability begins at an odd time like 17:10.
 */
function buildCandidates(
  trainers: SolveInput['trainers'],
  options: SolveOptions,
): Array<Candidate> {
  const { sessionMinutes, slotStepMinutes } = options
  const seen = new Set<string>()
  const out: Array<Candidate> = []

  for (const trainer of trainers) {
    for (const slot of trainer.availability) {
      const first = Math.ceil(slot.startMin / slotStepMinutes) * slotStepMinutes
      for (
        let start = first;
        start + sessionMinutes <= slot.endMin;
        start += slotStepMinutes
      ) {
        // Availability rows may overlap each other; dedupe so a slot is not
        // weighed twice.
        const key = `${trainer.id}:${slot.weekday}:${start}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          trainerId: trainer.id,
          weekday: slot.weekday,
          startMin: start,
          endMin: start + sessionMinutes,
        })
      }
    }
  }

  out.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startMin - b.startMin ||
      (a.trainerId < b.trainerId ? -1 : 1),
  )
  return out
}

function trainerBusy(groups: Array<SolvedGroup>, candidate: Candidate) {
  return groups.some(
    (g) =>
      g.trainerId === candidate.trainerId &&
      g.weekday === candidate.weekday &&
      overlaps(g.startMin, g.endMin, candidate.startMin, candidate.endMin),
  )
}

/** Lowest court index nothing else is using during the window, else null. */
function freeCourt(
  groups: Array<SolvedGroup>,
  candidate: Candidate,
  courtCount: number,
) {
  const used = new Set(
    groups
      .filter(
        (g) =>
          g.weekday === candidate.weekday &&
          overlaps(g.startMin, g.endMin, candidate.startMin, candidate.endMin),
      )
      .map((g) => g.court),
  )
  for (let court = 1; court <= courtCount; court++) {
    if (!used.has(court)) return court
  }
  return null
}

/**
 * The best group formable in one slot. Sorting by strength makes every legal
 * group a contiguous window, so a single sweep finds the best one per ball.
 */
function bestGroupAt(
  candidate: Candidate,
  pool: Array<Trainee>,
  options: SolveOptions,
): Pick | null {
  const free = pool.filter((t) =>
    covers(
      t.availability,
      candidate.weekday,
      candidate.startMin,
      candidate.endMin,
    ),
  )
  if (free.length < options.minGroupSize) return null

  let best: Pick | null = null
  for (const ball of BALLS) {
    const ranked = free
      .filter((t) => t.ball === ball)
      .sort((a, b) => a.strength - b.strength || (a.id < b.id ? -1 : 1))

    for (let i = 0; i < ranked.length; i++) {
      for (
        let j = i;
        j < ranked.length && j - i + 1 <= options.maxGroupSize;
        j++
      ) {
        const spread = ranked[j].strength - ranked[i].strength
        if (spread > options.strengthSpread) break
        if (j - i + 1 < options.minGroupSize) continue

        const pick: Pick = {
          ball,
          spread,
          traineeIds: ranked.slice(i, j + 1).map((t) => t.id),
        }
        if (!best || isBetter(pick, best)) best = pick
      }
    }
  }
  return best
}

function isBetter(a: Pick, b: Pick) {
  if (a.traineeIds.length !== b.traineeIds.length) {
    return a.traineeIds.length > b.traineeIds.length
  }
  return a.spread < b.spread
}

function whyUnplaced(trainee: Trainee, candidates: Array<Candidate>) {
  if (trainee.availability.length === 0) return 'NO_AVAILABILITY'
  const meetsATrainer = candidates.some((c) =>
    covers(trainee.availability, c.weekday, c.startMin, c.endMin),
  )
  return meetsATrainer ? 'NO_COMPATIBLE_GROUP' : 'NO_TRAINER_OVERLAP'
}
