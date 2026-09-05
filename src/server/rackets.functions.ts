import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import { memberMiddleware } from '#/lib/auth-middleware'
import { idSchema, racketInputSchema } from '#/lib/schemas'
import { isOpen } from '#/lib/status'

/**
 * Rackets are strictly owner-scoped: every query and mutation filters by the
 * session user's id, so a guessed racket id gets a 404, not someone else's data.
 */

export const listRackets = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .validator(z.object({ includeArchived: z.boolean().default(false) }))
  .handler(async ({ context, data }) => {
    return prisma.racket.findMany({
      where: {
        ownerId: context.user.id,
        ...(data.includeArchived ? {} : { archived: false }),
      },
      orderBy: [{ archived: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { requests: true } },
      },
    })
  })

export const getRacket = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    const racket = await prisma.racket.findFirst({
      where: { id: data.id, ownerId: context.user.id },
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
  .validator(racketInputSchema.extend({ id: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { id, ...fields } = data
    const { count } = await prisma.racket.updateMany({
      where: { id, ownerId: context.user.id },
      data: fields,
    })
    if (count === 0) throw notFound()
    return { id }
  })

/**
 * Archive rather than delete once a racket has history, so finished jobs keep
 * showing which racket they were for.
 */
export const setRacketArchived = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema.extend({ archived: z.boolean() }))
  .handler(async ({ context, data }) => {
    const racket = await prisma.racket.findFirst({
      where: { id: data.id, ownerId: context.user.id },
      include: { requests: { select: { status: true } } },
    })
    if (!racket) throw notFound()

    if (data.archived && racket.requests.some((r) => isOpen(r.status))) {
      throw new Error(
        'Finish or cancel the open requests for this racket first',
      )
    }

    await prisma.racket.update({
      where: { id: data.id },
      data: { archived: data.archived },
    })
    return { id: data.id }
  })

export const deleteRacket = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    const racket = await prisma.racket.findFirst({
      where: { id: data.id, ownerId: context.user.id },
      include: { _count: { select: { requests: true } } },
    })
    if (!racket) throw notFound()
    if (racket._count.requests > 0) {
      throw new Error(
        'This racket has restringing history — archive it instead',
      )
    }

    await prisma.racket.delete({ where: { id: data.id } })
    return { id: data.id }
  })
