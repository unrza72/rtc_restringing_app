import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import { adminMiddleware, memberMiddleware } from '#/lib/auth-middleware'
import { clubStringInputSchema, idSchema } from '#/lib/schemas'

/** The club's string catalogue. Members read it; only admins change it. */

export const listActiveStrings = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .handler(async () => {
    return prisma.clubString.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  })

export const listAllStrings = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    return prisma.clubString.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { requests: true } } },
    })
  })

export const createClubString = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(clubStringInputSchema)
  .handler(async ({ data }) => prisma.clubString.create({ data }))

export const updateClubString = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(clubStringInputSchema.extend({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    return prisma.clubString.update({ where: { id }, data: fields })
  })

/**
 * Strings that have never been used can go entirely; once a job references one
 * it is only deactivated, so historical jobs still name what was strung.
 */
export const removeClubString = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const clubString = await prisma.clubString.findUnique({
      where: { id: data.id },
      include: { _count: { select: { requests: true } } },
    })
    if (!clubString) throw notFound()

    if (clubString._count.requests > 0) {
      await prisma.clubString.update({
        where: { id: data.id },
        data: { active: false },
      })
      return { id: data.id, deactivated: true }
    }

    await prisma.clubString.delete({ where: { id: data.id } })
    return { id: data.id, deactivated: false }
  })
