/**
 * The grouping solver's vocabulary. Deliberately free of Prisma, React and
 * anything else app-shaped: the solver is a separate module that takes plain
 * data in and gives plain data back, so it can be unit-checked without a
 * database or a server. See `solve.ts`.
 */

export const BALLS = ['RED', 'ORANGE', 'GREEN', 'YELLOW'] as const
export type Ball = (typeof BALLS)[number]

/** Weekdays are 0 = Monday … 6 = Sunday; times are minutes from midnight. */
export type Slot = {
  weekday: number
  startMin: number
  endMin: number
}

export type Trainee = {
  id: string
  ball: Ball
  /** 0 (beginner) … 5 (strongest) within that ball. */
  strength: number
  availability: Array<Slot>
}

export type Trainer = {
  id: string
  availability: Array<Slot>
}

export type SolveOptions = {
  minGroupSize: number
  maxGroupSize: number
  /** Largest allowed gap between the weakest and strongest player in a group. */
  strengthSpread: number
  sessionMinutes: number
  /** Sessions may start only on this grid, e.g. 30 → :00 and :30. */
  slotStepMinutes: number
  /** How many groups may run at the same time. */
  courtCount: number
}

export type SolveInput = {
  trainees: Array<Trainee>
  trainers: Array<Trainer>
  options: SolveOptions
}

export type SolvedGroup = {
  trainerId: string
  weekday: number
  startMin: number
  endMin: number
  ball: Ball
  /** 1 … courtCount. Which physical court is left to the club. */
  court: number
  traineeIds: Array<string>
}

export const UNPLACED_REASONS = [
  /** Nothing entered, so there was nothing to match against. */
  'NO_AVAILABILITY',
  /** Free at some point, but never while a trainer was. */
  'NO_TRAINER_OVERLAP',
  /** Shared a slot with a trainer, but never with enough compatible peers. */
  'NO_COMPATIBLE_GROUP',
] as const
export type UnplacedReason = (typeof UNPLACED_REASONS)[number]

export type Unplaced = { traineeId: string; reason: UnplacedReason }

export type SolveResult = {
  groups: Array<SolvedGroup>
  unplaced: Array<Unplaced>
}
