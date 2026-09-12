import { z } from 'zod'

import { locales } from '#/paraglide/runtime'

import { ROLES, USER_STATUSES } from './roles'
import { STRING_SOURCES } from './status'
import { BALLS, MAX_STRENGTH, MIN_STRENGTH, PERSON_KINDS } from './training'

/** Shared by the forms and the server functions, so both reject the same input. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null)

export const racketInputSchema = z.object({
  label: z.string().trim().min(1, 'Give the racket a name').max(80),
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
  .min(10, 'Tension looks too low')
  .max(35, 'Tension looks too high')

export const requestInputSchema = z
  .object({
    racketId: z.string().min(1, 'Pick a racket'),
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
    message: 'Pick a string from the club catalogue',
    path: ['clubStringId'],
  })
  .refine((v) => v.stringSource !== 'MEMBER' || !!v.ownStringName, {
    message: 'Name the string you are bringing',
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
    .min(1, 'What did you string it with?')
    .max(120),
  usedTensionMain: tension,
  usedTensionCross: tension.nullable().default(null),
  stringPriceCents: priceInput,
  labourPriceCents: priceInput,
  operatorNotes: optionalText(500),
})

export const clubStringInputSchema = z.object({
  name: z.string().trim().min(1, 'Name the string').max(80),
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
    name: z.string().trim().min(1, 'Give the person a name').max(80),
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
    message: 'Pick the ball this player trains with',
    path: ['ball'],
  })
  .refine((v) => v.kind !== 'TRAINEE' || v.strength !== null, {
    message: 'Rate the player from 0 to 5',
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
  message: 'The end has to come after the start',
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
    name: z.string().trim().min(1, 'Name the plan').max(80),
    minGroupSize: z.coerce.number().int().min(1).max(20),
    maxGroupSize: z.coerce.number().int().min(1).max(20),
    strengthSpread: z.coerce.number().min(0).max(5),
    sessionMinutes: z.coerce.number().int().min(15).max(240),
    slotStepMinutes: z.coerce.number().int().min(5).max(120),
    courtCount: z.coerce.number().int().min(1).max(20),
  })
  .refine((v) => v.maxGroupSize >= v.minGroupSize, {
    message: 'The maximum cannot be below the minimum',
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
