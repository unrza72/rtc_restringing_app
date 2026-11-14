import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'

import { prisma } from '#/db'
import type { Prisma } from '#/generated/prisma/client'
import { adminMiddleware } from '#/lib/auth-middleware'
import {
  memberDecisionSchema,
  memberIdSchema,
  memberRolesSchema,
} from '#/lib/schemas'
import { parseRoles, serializeRoles } from '#/lib/roles'
import { m } from '#/paraglide/messages'

/**
 * Admin-only member administration: approvals, role assignment, deletion.
 * Every change is recorded in the member audit log, in the same transaction.
 */

type Actor = { id: string; name: string }
type Target = { id: string; name: string; email: string }

function recordAudit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  target: Target,
  entry: { action: string; fromValue?: string | null; toValue?: string | null },
) {
  return tx.memberAuditEntry.create({
    data: {
      ...entry,
      actorId: actor.id,
      actorName: actor.name,
      targetId: target.id,
      targetName: target.name,
      targetEmail: target.email,
    },
  })
}

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
      throw new Error(m.members_cannot_change_own_status())
    }

    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, name: true, email: true, status: true },
      })
      if (!target) throw notFound()

      await tx.user.update({
        where: { id: data.userId },
        data: {
          status: data.status,
          approvedAt: data.status === 'APPROVED' ? new Date() : null,
          approvedById: data.status === 'APPROVED' ? context.user.id : null,
        },
      })
      if (target.status !== data.status) {
        await recordAudit(tx, context.user, target, {
          action: data.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          fromValue: target.status ?? 'PENDING',
          toValue: data.status,
        })
      }
    })

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
      throw new Error(m.members_cannot_remove_own_admin())
    }

    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, name: true, email: true, role: true },
      })
      if (!target) throw notFound()
      const before = parseRoles(target.role)

      // Never leave the club without an admin.
      if (!data.roles.includes('admin') && before.includes('admin')) {
        const admins = await tx.user.count({
          where: { role: { contains: 'admin' }, status: 'APPROVED' },
        })
        if (admins <= 1) throw new Error(m.admin_last_admin())
      }

      const role = serializeRoles(data.roles)
      await tx.user.update({ where: { id: data.userId }, data: { role } })
      // Compared as effective roles: granting admin is one change, not five.
      const after = parseRoles(role)
      const changed =
        before.length !== after.length || before.some((r) => !after.includes(r))
      if (changed) {
        await recordAudit(tx, context.user, target, {
          action: 'ROLES_CHANGED',
          fromValue: target.role ?? 'member',
          toValue: role,
        })
      }
    })

    return { id: data.userId, roles: data.roles }
  })

/**
 * Removes an account for good: the login, sessions, rackets and any invites
 * the person created. Refused while anything else in the club's records points
 * at them — requests (theirs or strung by them), payments they recorded,
 * payouts, training plans — since deleting those would change billing and
 * payout balances. Such members can still be rejected.
 */
export const deleteMember = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(memberIdSchema)
  .handler(async ({ context, data }) => {
    if (data.userId === context.user.id) {
      throw new Error(m.admin_delete_self())
    }

    const target = await prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            requests: true,
            stringingJobs: true,
            paidRequests: true,
            events: true,
            labourEarned: true,
            reimbursementsRecorded: true,
            trainingPlans: true,
          },
        },
      },
    })
    if (!target) throw notFound()
    if (Object.values(target._count).some((n) => n > 0)) {
      throw new Error(m.admin_delete_has_history())
    }

    const person = { id: target.id, name: target.name, email: target.email }
    await prisma.$transaction([
      // Written first, while the account still exists; deleting it then
      // clears the link but keeps the entry with the copied name and email.
      prisma.memberAuditEntry.create({
        data: {
          action: 'DELETED',
          actorId: context.user.id,
          actorName: context.user.name,
          targetId: person.id,
          targetName: person.name,
          targetEmail: person.email,
        },
      }),
      // Keep the invite that brought someone else in, just without the link.
      prisma.invite.updateMany({
        where: { usedById: data.userId },
        data: { usedById: null },
      }),
      prisma.invite.deleteMany({ where: { createdById: data.userId } }),
      prisma.user.updateMany({
        where: { approvedById: data.userId },
        data: { approvedById: null },
      }),
      // Sessions, accounts and rackets cascade.
      prisma.user.delete({ where: { id: data.userId } }),
    ])

    return { id: data.userId }
  })

/** The newest audit entries first; enough to look back over a season. */
export const listMemberAudit = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    const entries = await prisma.memberAuditEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        action: true,
        actorName: true,
        actorId: true,
        targetName: true,
        targetEmail: true,
        fromValue: true,
        toValue: true,
        createdAt: true,
      },
    })
    return entries
  })
