import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { prisma } from '#/db'
import { memberMiddleware, operatorMiddleware } from '#/lib/auth-middleware'
import {
  completeInputSchema,
  idSchema,
  requestInputSchema,
} from '#/lib/schemas'
import { REQUEST_STATUSES, canTransition, nextStatus } from '#/lib/status'
import type { RequestAction } from '#/lib/status'

const requestInclude = {
  racket: true,
  clubString: true,
  requester: { select: { id: true, name: true } },
  operator: { select: { id: true, name: true } },
} as const

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

export const listMyRequests = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    return prisma.stringingRequest.findMany({
      where: { requesterId: context.user.id },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    })
  })

/** Owner or operator. Everyone else gets a 404 rather than a hint it exists. */
export const getRequest = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    const request = await prisma.stringingRequest.findUnique({
      where: { id: data.id },
      include: {
        ...requestInclude,
        events: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    })
    if (!request) throw notFound()

    const isOwner = request.requesterId === context.user.id
    const isOperator = context.user.roles.includes('operator')
    if (!isOwner && !isOperator) throw notFound()

    return { ...request, viewerIsOwner: isOwner, viewerIsOperator: isOperator }
  })

export const listQueue = createServerFn({ method: 'GET' })
  .middleware([operatorMiddleware])
  .validator(
    z.object({
      status: z.enum(REQUEST_STATUSES).nullable().default(null),
      mine: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, data }) => {
    return prisma.stringingRequest.findMany({
      where: {
        ...(data.status
          ? { status: data.status }
          : { status: { in: ['REQUESTED', 'ACCEPTED', 'DONE'] } }),
        ...(data.mine ? { operatorId: context.user.id } : {}),
      },
      // Jobs with a deadline first, then oldest request first.
      orderBy: [{ neededBy: 'asc' }, { createdAt: 'asc' }],
      include: requestInclude,
    })
  })

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const createRequest = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(requestInputSchema)
  .handler(async ({ context, data }) => {
    // The racket must be the caller's, and still in use.
    const racket = await prisma.racket.findFirst({
      where: { id: data.racketId, ownerId: context.user.id, archived: false },
      select: { id: true },
    })
    if (!racket) throw notFound()

    if (data.clubStringId) {
      const clubString = await prisma.clubString.findFirst({
        where: { id: data.clubStringId, active: true },
        select: { id: true },
      })
      if (!clubString) throw new Error('That string is no longer available')
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.stringingRequest.create({
        data: { ...data, requesterId: context.user.id, status: 'REQUESTED' },
      })
      await tx.requestEvent.create({
        data: {
          requestId: created.id,
          actorId: context.user.id,
          toStatus: 'REQUESTED',
        },
      })
      return created
    })
  })

// ---------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------

type TransitionOptions = {
  requestId: string
  actorId: string
  action: RequestAction
  /** Extra `where` clauses that must still hold at write time. */
  guard?: Record<string, unknown>
  data?: Record<string, unknown>
  note?: string | null
}

/**
 * Applies one state change. The current status is part of the `where` clause, so
 * two operators racing to accept the same job resolve to exactly one winner —
 * the loser's update matches no rows and is reported as a conflict.
 */
async function transition({
  requestId,
  actorId,
  action,
  guard = {},
  data = {},
  note = null,
}: TransitionOptions) {
  const to = nextStatus(action)

  return prisma.$transaction(async (tx) => {
    const current = await tx.stringingRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    })
    if (!current) throw notFound()
    if (!canTransition(current.status, action)) {
      throw new Error(`Cannot ${action} a request that is ${current.status}`)
    }

    const { count } = await tx.stringingRequest.updateMany({
      where: { id: requestId, status: current.status, ...guard },
      data: { ...data, status: to },
    })
    if (count === 0) {
      throw new Error(
        'Someone else changed this request — reload and try again',
      )
    }

    await tx.requestEvent.create({
      data: {
        requestId,
        actorId,
        fromStatus: current.status,
        toStatus: to,
        note,
      },
    })
    return { id: requestId, status: to }
  })
}

export const acceptRequest = createServerFn({ method: 'POST' })
  .middleware([operatorMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) =>
    transition({
      requestId: data.id,
      actorId: context.user.id,
      action: 'accept',
      // Only claim a job nobody else holds.
      guard: { operatorId: null },
      data: { operatorId: context.user.id, acceptedAt: new Date() },
    }),
  )

export const releaseRequest = createServerFn({ method: 'POST' })
  .middleware([operatorMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) =>
    transition({
      requestId: data.id,
      actorId: context.user.id,
      action: 'release',
      // Admins can pull a job back from anyone; operators only their own.
      guard: context.user.roles.includes('admin')
        ? {}
        : { operatorId: context.user.id },
      data: { operatorId: null, acceptedAt: null },
    }),
  )

export const completeRequest = createServerFn({ method: 'POST' })
  .middleware([operatorMiddleware])
  .validator(completeInputSchema)
  .handler(async ({ context, data }) => {
    const { id, operatorNotes, ...used } = data
    return transition({
      requestId: id,
      actorId: context.user.id,
      action: 'complete',
      guard: context.user.roles.includes('admin')
        ? {}
        : { operatorId: context.user.id },
      data: { ...used, operatorNotes, completedAt: new Date() },
      note: operatorNotes,
    })
  })

/** Either side can confirm the handover. */
export const collectRequest = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => {
    const request = await prisma.stringingRequest.findUnique({
      where: { id: data.id },
      select: { requesterId: true },
    })
    if (!request) throw notFound()

    const allowed =
      request.requesterId === context.user.id ||
      context.user.roles.includes('operator')
    if (!allowed) throw notFound()

    return transition({
      requestId: data.id,
      actorId: context.user.id,
      action: 'collect',
      data: { collectedAt: new Date() },
    })
  })

export const cancelRequest = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .validator(idSchema.extend({ reason: z.string().trim().max(300).optional() }))
  .handler(async ({ context, data }) => {
    const request = await prisma.stringingRequest.findUnique({
      where: { id: data.id },
      select: { requesterId: true },
    })
    if (!request) throw notFound()

    const allowed =
      request.requesterId === context.user.id ||
      context.user.roles.includes('admin')
    if (!allowed) throw notFound()

    return transition({
      requestId: data.id,
      actorId: context.user.id,
      action: 'cancel',
      note: data.reason ?? null,
    })
  })
