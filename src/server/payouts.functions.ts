import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { controllerMiddleware } from '#/lib/auth-middleware'
import { recordReimbursementSchema } from '#/lib/schemas'

/**
 * The labour payout ledger. A stringer earns their share of a job's price —
 * `labourPriceCents` — once the member has actually paid; the controller then
 * reimburses that out to the stringer over time and each payout is logged
 * here. Deliberately controller-only (unlike /billing, which any stringer can
 * also see): this is who-was-paid-how-much, not job pricing.
 *
 * Outstanding balance is never stored — always earned-so-far minus
 * reimbursed-so-far, computed fresh, so it can't drift out of sync with the
 * two tables it's derived from.
 */

export const listLabourBalances = createServerFn({ method: 'GET' })
  .middleware([controllerMiddleware])
  .handler(async () => {
    const [earned, reimbursed] = await Promise.all([
      prisma.stringingRequest.groupBy({
        by: ['operatorId'],
        where: { paidAt: { not: null }, operatorId: { not: null } },
        _sum: { labourPriceCents: true },
      }),
      prisma.reimbursement.groupBy({
        by: ['operatorId'],
        _sum: { amountCents: true },
      }),
    ])

    const operatorIds = new Set<string>()
    for (const row of earned)
      if (row.operatorId) operatorIds.add(row.operatorId)
    for (const row of reimbursed) operatorIds.add(row.operatorId)

    const operators = await prisma.user.findMany({
      where: { id: { in: [...operatorIds] } },
      select: { id: true, name: true },
    })
    const nameById = new Map(operators.map((o) => [o.id, o.name]))
    const earnedById = new Map(
      earned.map((r) => [r.operatorId, r._sum.labourPriceCents ?? 0]),
    )
    const reimbursedById = new Map(
      reimbursed.map((r) => [r.operatorId, r._sum.amountCents ?? 0]),
    )

    return [...operatorIds]
      .map((id) => {
        const earnedCents = earnedById.get(id) ?? 0
        const reimbursedCents = reimbursedById.get(id) ?? 0
        return {
          operatorId: id,
          name: nameById.get(id) ?? 'Unknown',
          earnedCents,
          reimbursedCents,
          outstandingCents: earnedCents - reimbursedCents,
        }
      })
      .sort((a, b) => b.outstandingCents - a.outstandingCents)
  })

/** Recent history, most recent first — the audit trail behind the balances above. */
export const listReimbursements = createServerFn({ method: 'GET' })
  .middleware([controllerMiddleware])
  .handler(async () => {
    return prisma.reimbursement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        operator: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  })

export const recordReimbursement = createServerFn({ method: 'POST' })
  .middleware([controllerMiddleware])
  .validator(recordReimbursementSchema)
  .handler(async ({ context, data }) => {
    // Recomputed here rather than trusting a client-supplied balance, so a
    // screen left open too long can't authorize paying out twice.
    const [earned, reimbursed] = await Promise.all([
      prisma.stringingRequest.aggregate({
        where: { operatorId: data.operatorId, paidAt: { not: null } },
        _sum: { labourPriceCents: true },
      }),
      prisma.reimbursement.aggregate({
        where: { operatorId: data.operatorId },
        _sum: { amountCents: true },
      }),
    ])
    const outstanding =
      (earned._sum.labourPriceCents ?? 0) - (reimbursed._sum.amountCents ?? 0)
    if (data.amountCents > outstanding) {
      throw new Error(
        'That is more than the outstanding balance for this stringer',
      )
    }

    return prisma.reimbursement.create({
      data: {
        operatorId: data.operatorId,
        amountCents: data.amountCents,
        note: data.note,
        createdById: context.user.id,
      },
    })
  })
