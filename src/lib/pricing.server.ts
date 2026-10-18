import { prisma } from '#/db'

/**
 * The club's flat prices, set by an admin: labour per racket (the same for
 * every stringer) and the extra fee for stringing a member's own string.
 * Server-only — import from a server function's handler, never from a route.
 */
export async function getClubPricing() {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 1 } })
  return {
    labourPriceCents: settings?.labourPriceCents ?? null,
    ownStringFeeCents: settings?.ownStringFeeCents ?? null,
  }
}
