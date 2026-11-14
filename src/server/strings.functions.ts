import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import { adminMiddleware, memberMiddleware } from '#/lib/auth-middleware'
import { clubStringInputSchema, idSchema } from '#/lib/schemas'
import { m } from '#/paraglide/messages'

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
 * Deletes a string from the catalogue for good, used or not. Refused while an
 * open request still waits for it — the stringer needs to know what to string.
 * Finished and cancelled jobs keep the string's name: it is copied into
 * `ownStringName`, which `describeString` shows when the catalogue entry is
 * gone. Their prices were stamped on completion, so billing is unaffected.
 * To only take a string off the request form, deactivate it instead.
 */
export const removeClubString = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const clubString = await prisma.clubString.findUnique({
      where: { id: data.id },
    })
    if (!clubString) throw notFound()

    const open = await prisma.stringingRequest.count({
      where: {
        clubStringId: data.id,
        status: { in: ['REQUESTED', 'ACCEPTED'] },
      },
    })
    if (open > 0) throw new Error(m.admin_string_delete_open({ count: open }))

    const name = [clubString.name, clubString.gauge].filter(Boolean).join(' ')
    await prisma.$transaction([
      prisma.stringingRequest.updateMany({
        where: { clubStringId: data.id },
        data: { clubStringId: null, ownStringName: name },
      }),
      prisma.clubString.delete({ where: { id: data.id } }),
    ])
    return { id: data.id }
  })
