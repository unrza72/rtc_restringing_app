import { prisma } from '#/db'

/**
 * The club's flat prices, set by an admin: labour per racket (the same for
 * every stringer, reimbursed to them) and the club's rake (kept by the club).
 * Together with the club string's catalogue price they make up a job's price.
 * Server-only — import from a server function's handler, never from a route.
 */
export async function getClubPricing() {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 1 } })
  return {
    labourPriceCents: settings?.labourPriceCents ?? null,
    rakeCents: settings?.rakeCents ?? null,
  }
}
