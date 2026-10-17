import { prisma } from '#/db'

/**
 * Racket tokens: numbered carabiners a member clips to their racket when they
 * leave it in the clubhouse, so the stringer can tell whose it is. Off unless
 *   RACKET_TOKENS_ENABLED=true
 * Server-only — import from a server function's handler, never from a route.
 */

export function isRacketTokensEnabled() {
  return process.env.RACKET_TOKENS_ENABLED === 'true'
}

/** Until an admin sets a number, the club is assumed to have this many. */
export const DEFAULT_TOKEN_COUNT = 20

export async function getTokenCount() {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 1 } })
  return settings?.tokenCount ?? DEFAULT_TOKEN_COUNT
}

/** Tokens currently on a racket somewhere between requested and picked up. */
export async function getTokensInUse() {
  const rows = await prisma.stringingRequest.findMany({
    where: { activeToken: { not: null } },
    select: { activeToken: true },
    orderBy: { activeToken: 'asc' },
  })
  return rows.map((row) => row.activeToken!)
}
