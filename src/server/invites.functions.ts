import { randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'

import { prisma } from '#/db'
import { operatorMiddleware } from '#/lib/auth-middleware'
import { isInviteActive } from '#/lib/invites'
import { checkInviteSchema, createInviteSchema, idSchema } from '#/lib/schemas'

/**
 * Invite links are how /signup is gated — see src/lib/auth.ts's
 * validateUserInfo for the actual enforcement. Everything here is management
 * (create/list/revoke, for operator+admin) or the public pre-flight check
 * /signup uses to show "this link is invalid" before rendering a form.
 */

export const listInvites = createServerFn({ method: 'GET' })
  .middleware([operatorMiddleware])
  .handler(async () => {
    return prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        usedBy: { select: { id: true, name: true } },
      },
    })
  })

export const createInvite = createServerFn({ method: 'POST' })
  .middleware([operatorMiddleware])
  .validator(createInviteSchema)
  .handler(async ({ context, data }) => {
    const token = randomBytes(24).toString('base64url')
    const expiresAt = new Date(
      Date.now() + data.expiresInHours * 60 * 60 * 1000,
    )
    return prisma.invite.create({
      data: { token, expiresAt, createdById: context.user.id },
    })
  })

export const revokeInvite = createServerFn({ method: 'POST' })
  .middleware([operatorMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const invite = await prisma.invite.findUnique({ where: { id: data.id } })
    if (!invite) throw notFound()
    if (invite.usedAt) throw new Error('This invite has already been used')

    await prisma.invite.updateMany({
      where: { id: data.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { id: data.id }
  })

/** Public — an anonymous visitor on /signup needs this before they have any account. */
export const checkInvite = createServerFn({ method: 'GET' })
  .validator(checkInviteSchema)
  .handler(async ({ data }) => {
    if (!data.token) return { valid: false }

    const invite = await prisma.invite.findUnique({
      where: { token: data.token },
      select: { usedAt: true, revokedAt: true, expiresAt: true },
    })
    if (!invite) return { valid: false }

    return { valid: isInviteActive(invite) }
  })
