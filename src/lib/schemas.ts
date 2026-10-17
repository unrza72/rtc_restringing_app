import { z } from 'zod'

import { locales } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'

import { ROLES, USER_STATUSES } from './roles'
import { STRING_SOURCES } from './status'
import { BALLS, MAX_STRENGTH, MIN_STRENGTH, PERSON_KINDS } from './training'

/**
 * Shared by the forms and the server functions, so both reject the same input.
 *
 * Validation messages use Zod's `{ error: () => m.foo() }` function form rather
 * than a plain string. These schemas are built once, at module load, and shared
 * across every request — a plain string (or an `m.foo()` call made directly at
 * that call site) would freeze in whatever locale happened to be active at that
 * first import. `error`'s function form defers the `m.foo()` call to parse
 * time, so it reads the current request's locale instead. Zod's `message` is
 * the same idea but string-only (no function form, deprecated) — use `error`.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null)

export const racketInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { error: () => m.racket_name_required() })
    .max(80),
  brand: optionalText(60),
  model: optionalText(60),
  headSizeCm2: z.coerce
    .number()
    .int()
    .min(400)
    .max(900)
    .nullable()
    .default(null),
  stringPattern: optionalText(20),
  gripSize: optionalText(10),
  notes: optionalText(500),
})
export type RacketInput = z.infer<typeof racketInputSchema>

const tension = z.coerce
  .number()
  .min(10, { error: () => m.request_tension_too_low() })
  .max(35, { error: () => m.request_tension_too_high() })

export const requestInputSchema = z
  .object({
    // null = a member with no racket of their own yet; the server files the
    // request under their hidden stand-in racket instead (see createRequest).
    racketId: z
      .string()
      .min(1, { error: () => m.request_racket_required() })
      .nullable()
      .default(null),
    stringSource: z.enum(STRING_SOURCES),
    clubStringId: z.string().nullable().default(null),
    ownStringName: optionalText(120),
    tensionMain: tension,
    tensionCross: tension.nullable().default(null),
    neededBy: z.coerce.date().nullable().default(null),
    memberNotes: optionalText(500),
  })
  // A request names exactly one string: a catalogue entry or the member's own.
  .refine((v) => v.stringSource !== 'CLUB' || !!v.clubStringId, {
    error: () => m.request_club_string_required(),
    path: ['clubStringId'],
  })
  .refine((v) => v.stringSource !== 'MEMBER' || !!v.ownStringName, {
    error: () => m.request_own_string_required(),
    path: ['ownStringName'],
  })
  .transform((v) => ({
    ...v,
    clubStringId: v.stringSource === 'CLUB' ? v.clubStringId : null,
    ownStringName: v.stringSource === 'MEMBER' ? v.ownStringName : null,
  }))
export type RequestInput = z.infer<typeof requestInputSchema>

const priceInput = z.coerce
  .number()
  .int()
  .min(0)
  .max(100000)
  .nullable()
  .default(null)

export const completeInputSchema = z.object({
  id: z.string().min(1),
  usedStringName: z
    .string()
    .trim()
    .min(1, { error: () => m.request_used_string_required() })
    .max(120),
  usedTensionMain: tension,
  usedTensionCross: tension.nullable().default(null),
  stringPriceCents: priceInput,
  labourPriceCents: priceInput,
  operatorNotes: optionalText(500),
})

export const clubStringInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.admin_string_name_required() })
    .max(80),
  gauge: optionalText(10),
  priceCents: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .default(null),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export const memberDecisionSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(USER_STATUSES),
})

export const memberRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1),
})

export const idSchema = z.object({ id: z.string().min(1) })

export const setPaidSchema = idSchema.extend({ paid: z.boolean() })

export const recordReimbursementSchema = z.object({
  operatorId: z.string().min(1),
  amountCents: z.coerce.number().int().min(1).max(1000000),
  note: optionalText(300),
})

export const localeInputSchema = z.object({ locale: z.enum(locales) })

// ---------------------------------------------------------------------------
// training planner
// ---------------------------------------------------------------------------

export const trainingPersonInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: () => m.training_person_name_required() })
      .max(80),
    kind: z.enum(PERSON_KINDS),
    ball: z.enum(BALLS).nullable().default(null),
    strength: z.coerce
      .number()
      .min(MIN_STRENGTH)
      .max(MAX_STRENGTH)
      .nullable()
      .default(null),
    notes: optionalText(300),
  })
  // Ball and strength are what the solver groups on, so a trainee without them
  // could never be placed. Trainers are graded by neither.
  .refine((v) => v.kind !== 'TRAINEE' || v.ball !== null, {
    error: () => m.training_ball_required(),
    path: ['ball'],
  })
  .refine((v) => v.kind !== 'TRAINEE' || v.strength !== null, {
    error: () => m.training_strength_required(),
    path: ['strength'],
  })
  .transform((v) => ({
    ...v,
    ball: v.kind === 'TRAINEE' ? v.ball : null,
    strength: v.kind === 'TRAINEE' ? v.strength : null,
  }))

const slotFields = {
  weekday: z.coerce.number().int().min(0).max(6),
  startMin: z.coerce.number().int().min(0).max(1439),
  endMin: z.coerce.number().int().min(1).max(1440),
}
const endAfterStart = {
  error: () => m.training_slot_end_after_start(),
  path: ['endMin'],
}

export const availabilityInputSchema = z
  .object({ personId: z.string().min(1), ...slotFields })
  .refine((v) => v.endMin > v.startMin, endAfterStart)

/** The timetable owns a person's whole week, so it writes all slots at once. */
export const setAvailabilitySchema = z.object({
  personId: z.string().min(1),
  slots: z
    .array(
      z.object(slotFields).refine((v) => v.endMin > v.startMin, endAfterStart),
    )
    .max(200),
})

export const solvePlanSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: () => m.training_plan_name_required() })
      .max(80),
    minGroupSize: z.coerce.number().int().min(1).max(20),
    maxGroupSize: z.coerce.number().int().min(1).max(20),
    strengthSpread: z.coerce.number().min(0).max(5),
    sessionMinutes: z.coerce.number().int().min(15).max(240),
    slotStepMinutes: z.coerce.number().int().min(5).max(120),
    courtCount: z.coerce.number().int().min(1).max(20),
  })
  .refine((v) => v.maxGroupSize >= v.minGroupSize, {
    error: () => m.training_plan_max_below_min(),
    path: ['maxGroupSize'],
  })

export const createInviteSchema = z.object({
  // Hours, so the UI reads naturally for both "a few hours" and "a week"
  // without unit-switching; 24 matches the "default to 1 day" ask.
  expiresInHours: z.coerce.number().int().min(1).max(720).default(24),
})

export const checkInviteSchema = z.object({
  token: z.string().min(1).nullable().default(null),
})
