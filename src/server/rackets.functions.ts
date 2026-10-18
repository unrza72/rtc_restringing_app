import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import { memberMiddleware } from '#/lib/auth-middleware'
import { idSchema, racketInputSchema, racketUpdateSchema } from '#/lib/schemas'
import { OPEN_STATUSES } from '#/lib/status'
import { m } from '#/paraglide/messages'

/**
 * Rackets are strictly owner-scoped: every query and mutation filters by the
 * session user's id, so a guessed racket id gets a 404, not someone else's data.
 *
 * They also all skip the `hidden` stand-in a member gets when requesting a
 * restring with no racket of their own (see `createRequest`): it exists only
 * to carry those requests, and is never shown, edited, archived or deleted.
 * Soft-deleted rackets are skipped the same way.
 */

function visibleRacket(ownerId: string) {
  return { ownerId, hidden: false, deletedAt: null }
}

/** Requests still in the clubhouse's hands — they lock archive and delete. */
const openRequests = {
  where: { status: { in: OPEN_STATUSES } },
  select: { id: true },
  take: 1,
} as const

/**
 * A racket can only be archived or deleted while none of its requests is
 * still being worked on. Throws `notFound` for anything the caller can't see.
 */
async function findIdleRacket(ownerId: string, id: string, blocked: string) {
  const racket = await prisma.racket.findFirst({
    where: { id, ...visibleRacket(ownerId) },
    include: { requests: openRequests },
  })
  if (!racket) throw notFound()
  if (racket.requests.length > 0) throw new Error(blocked)
  return racket
}

export const listRackets = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .validator(z.object({ includeArchived: z.boolean().default(false) }))
  .handler(async ({ context, data }) => {
    const rackets = await prisma.racket.findMany({
      where: {
        ...visibleRacket(context.user.id),
        ...(data.includeArchived ? {} : { archived: false }),
      },
      orderBy: [{ archived: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { requests: true } },
        requests: openRequests,
      },
    })
    return rackets.map(({ requests, ...racket }) => ({
      ...racket,
      inProgress: requests.length > 0,
    }))
  })

export const getRacket = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    const racket = await prisma.racket.findFirst({
      where: { id: data.id, ...visibleRacket(context.user.id) },
      include: {
        requests: {
          orderBy: { createdAt: 'desc' },
          include: { clubString: true },
        },
      },
    })
    if (!racket) throw notFound()
    return racket
  })

export const createRacket = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(racketInputSchema)
  .handler(async ({ context, data }) => {
    return prisma.racket.create({
      data: { ...data, ownerId: context.user.id },
    })
  })

export const updateRacket = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(racketUpdateSchema)
  .handler(async ({ context, data }) => {
    const { id, ...fields } = data
    const { count } = await prisma.racket.updateMany({
      where: { id, ...visibleRacket(context.user.id) },
      data: fields,
    })
    if (count === 0) throw notFound()
    return { id }
  })

/**
 * Archive a racket the member no longer plays. Only while nothing is on the
 * machine for it; restoring is always allowed.
 */
export const setRacketArchived = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema.extend({ archived: z.boolean() }))
  .handler(async ({ context, data }) => {
    if (data.archived) {
      await findIdleRacket(context.user.id, data.id, m.racket_archive_blocked())
    }

    const { count } = await prisma.racket.updateMany({
      where: { id: data.id, ...visibleRacket(context.user.id) },
      data: { archived: data.archived },
    })
    if (count === 0) throw notFound()
    return { id: data.id }
  })

/**
 * Soft delete, so finished jobs keep showing which racket they were for.
 * Blocked while any request for it is still open.
 */
export const deleteRacket = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    await findIdleRacket(context.user.id, data.id, m.racket_delete_blocked())

    await prisma.racket.update({
      where: { id: data.id },
      data: { deletedAt: new Date() },
    })
    return { id: data.id }
  })
