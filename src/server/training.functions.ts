import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import type { Prisma } from '#/generated/prisma/client'
import { coachMiddleware } from '#/lib/auth-middleware'
import {
  availabilityInputSchema,
  idSchema,
  setAvailabilitySchema,
  solvePlanSchema,
  trainingPersonInputSchema,
} from '#/lib/schemas'
import { solve } from '#/solver/solve'
import type { Ball, Trainee, Trainer } from '#/solver/types'

/**
 * The training planner. Everything here is coaches only (admins inherit the
 * role); the solver itself lives in `#/solver` and never touches Prisma.
 */

const personWithSlots = {
  availability: { orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] },
} satisfies Prisma.TrainingPersonInclude

export const listTrainingPeople = createServerFn({ method: 'GET' })
  .middleware([coachMiddleware])
  .handler(async () => {
    return prisma.trainingPerson.findMany({
      orderBy: [{ archived: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
      include: personWithSlots,
    })
  })

export const getTrainingPerson = createServerFn({ method: 'GET' })
  .middleware([coachMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const person = await prisma.trainingPerson.findUnique({
      where: { id: data.id },
      include: personWithSlots,
    })
    if (!person) throw notFound()
    return person
  })

export const createTrainingPerson = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(trainingPersonInputSchema)
  .handler(async ({ data }) => prisma.trainingPerson.create({ data }))

export const updateTrainingPerson = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  // The person schema transforms, so it cannot be `.extend`ed with the id —
  // parse both halves off the same payload instead.
  .validator((input: unknown) => ({
    ...trainingPersonInputSchema.parse(input),
    id: idSchema.parse(input).id,
  }))
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    return prisma.trainingPerson.update({ where: { id }, data: fields })
  })

export const setPersonArchived = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(idSchema.extend({ archived: z.boolean() }))
  .handler(async ({ data }) =>
    prisma.trainingPerson.update({
      where: { id: data.id },
      data: { archived: data.archived },
    }),
  )

/**
 * Someone who has never been solved into a plan can go entirely; once a plan
 * references them they are only archived, so old plans still name everybody.
 */
export const removeTrainingPerson = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const person = await prisma.trainingPerson.findUnique({
      where: { id: data.id },
      include: {
        _count: {
          select: { memberships: true, ledGroups: true, unplacedIn: true },
        },
      },
    })
    if (!person) throw notFound()

    const used =
      person._count.memberships +
      person._count.ledGroups +
      person._count.unplacedIn
    if (used > 0) {
      await prisma.trainingPerson.update({
        where: { id: data.id },
        data: { archived: true },
      })
      return { id: data.id, archived: true }
    }

    await prisma.trainingPerson.delete({ where: { id: data.id } })
    return { id: data.id, archived: false }
  })

export const addAvailability = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(availabilityInputSchema)
  .handler(async ({ data }) => {
    const person = await prisma.trainingPerson.findUnique({
      where: { id: data.personId },
      select: { id: true },
    })
    if (!person) throw notFound()
    return prisma.trainingAvailability.create({ data })
  })

/**
 * Replaces a person's whole week in one go — what the timetable grid saves.
 * A diff would only be a slower route to the same state, since the grid always
 * knows the complete picture it is editing.
 */
export const setAvailability = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(setAvailabilitySchema)
  .handler(async ({ data }) => {
    const person = await prisma.trainingPerson.findUnique({
      where: { id: data.personId },
      select: { id: true },
    })
    if (!person) throw notFound()

    return prisma.$transaction(async (tx) => {
      await tx.trainingAvailability.deleteMany({
        where: { personId: data.personId },
      })
      if (data.slots.length > 0) {
        await tx.trainingAvailability.createMany({
          data: data.slots.map((slot) => ({
            personId: data.personId,
            ...slot,
          })),
        })
      }
      return tx.trainingAvailability.findMany({
        where: { personId: data.personId },
        orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
      })
    })
  })

export const removeAvailability = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    await prisma.trainingAvailability.delete({ where: { id: data.id } })
    return { id: data.id }
  })

// ---------------------------------------------------------------------------
// plans
// ---------------------------------------------------------------------------

const planWithEverything = {
  groups: {
    orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }, { court: 'asc' }],
    include: {
      trainer: { select: { id: true, name: true } },
      members: {
        include: {
          person: {
            select: { id: true, name: true, ball: true, strength: true },
          },
        },
      },
    },
  },
  unplaced: {
    include: {
      person: { select: { id: true, name: true, ball: true, strength: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TrainingPlanInclude

export const listTrainingPlans = createServerFn({ method: 'GET' })
  .middleware([coachMiddleware])
  .handler(async () => {
    return prisma.trainingPlan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { groups: true, unplaced: true } },
      },
    })
  })

export const getTrainingPlan = createServerFn({ method: 'GET' })
  .middleware([coachMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: data.id },
      include: planWithEverything,
    })
    if (!plan) throw notFound()
    return plan
  })

export const deleteTrainingPlan = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    await prisma.trainingPlan.delete({ where: { id: data.id } })
    return { id: data.id }
  })

/**
 * Runs the solver over everyone currently on the roster and stores the result.
 * Every run is kept, so two sets of knobs can be compared side by side rather
 * than one overwriting the other.
 */
export const solveAndSavePlan = createServerFn({ method: 'POST' })
  .middleware([coachMiddleware])
  .validator(solvePlanSchema)
  .handler(async ({ context, data }) => {
    const people = await prisma.trainingPerson.findMany({
      where: { archived: false },
      include: personWithSlots,
    })

    const slotsOf = (person: (typeof people)[number]) =>
      person.availability.map((a) => ({
        weekday: a.weekday,
        startMin: a.startMin,
        endMin: a.endMin,
      }))

    const trainees: Array<Trainee> = people
      .filter((p) => p.kind === 'TRAINEE' && p.ball !== null)
      .map((p) => ({
        id: p.id,
        ball: p.ball as Ball,
        strength: p.strength ?? 0,
        availability: slotsOf(p),
      }))

    const trainers: Array<Trainer> = people
      .filter((p) => p.kind === 'TRAINER')
      .map((p) => ({ id: p.id, availability: slotsOf(p) }))

    const { name, ...options } = data
    const result = solve({ trainees, trainers, options })

    return prisma.trainingPlan.create({
      data: {
        name,
        createdById: context.user.id,
        ...options,
        groups: {
          create: result.groups.map((group) => ({
            trainerId: group.trainerId,
            weekday: group.weekday,
            startMin: group.startMin,
            endMin: group.endMin,
            ball: group.ball,
            court: group.court,
            members: {
              create: group.traineeIds.map((personId) => ({ personId })),
            },
          })),
        },
        unplaced: {
          create: result.unplaced.map((u) => ({
            personId: u.traineeId,
            reason: u.reason,
          })),
        },
      },
      select: { id: true },
    })
  })
