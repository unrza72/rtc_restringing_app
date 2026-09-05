import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'

import { prisma } from '#/db'
import { adminMiddleware } from '#/lib/auth-middleware'
import { memberDecisionSchema, memberRolesSchema } from '#/lib/schemas'
import { parseRoles, serializeRoles } from '#/lib/roles'

/** Admin-only member administration: approvals and role assignment. */

export const listMembers = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    const users = await prisma.user.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        banned: true,
        createdAt: true,
        approvedAt: true,
        _count: { select: { requests: true, stringingJobs: true } },
      },
    })

    return users.map((u) => ({ ...u, roles: parseRoles(u.role) }))
  })

export const decideMember = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(memberDecisionSchema)
  .handler(async ({ context, data }) => {
    if (data.userId === context.user.id) {
      throw new Error('You cannot change your own approval status')
    }

    const { count } = await prisma.user.updateMany({
      where: { id: data.userId },
      data: {
        status: data.status,
        approvedAt: data.status === 'APPROVED' ? new Date() : null,
        approvedById: data.status === 'APPROVED' ? context.user.id : null,
      },
    })
    if (count === 0) throw notFound()

    // A rejected member should not keep browsing on an old session.
    if (data.status !== 'APPROVED') {
      await prisma.session.deleteMany({ where: { userId: data.userId } })
    }

    return { id: data.userId, status: data.status }
  })

export const setMemberRoles = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(memberRolesSchema)
  .handler(async ({ context, data }) => {
    if (data.userId === context.user.id && !data.roles.includes('admin')) {
      throw new Error('You cannot remove your own admin role')
    }

    // Never leave the club without an admin.
    if (!data.roles.includes('admin')) {
      const target = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { role: true },
      })
      if (target && parseRoles(target.role).includes('admin')) {
        const admins = await prisma.user.count({
          where: { role: { contains: 'admin' }, status: 'APPROVED' },
        })
        if (admins <= 1) throw new Error('The club needs at least one admin')
      }
    }

    const { count } = await prisma.user.updateMany({
      where: { id: data.userId },
      data: { role: serializeRoles(data.roles) },
    })
    if (count === 0) throw notFound()

    return { id: data.userId, roles: data.roles }
  })
