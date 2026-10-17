import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { adminMiddleware, memberMiddleware } from '#/lib/auth-middleware'
import {
  getTokenCount,
  getTokensInUse,
  isRacketTokensEnabled,
} from '#/lib/racket-tokens.server'
import { tokenCountSchema } from '#/lib/schemas'
import { m } from '#/paraglide/messages'

/**
 * Whether racket tokens are switched on, how many carabiners there are, and
 * which are on a racket right now. The numbers carry no personal data, so any
 * member may read them — the request form uses them to list the free ones.
 */
export const getTokenStatus = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .handler(async () => {
    if (!isRacketTokensEnabled()) {
      return { enabled: false, count: 0, inUse: [] as Array<number> }
    }
    const [count, inUse] = await Promise.all([
      getTokenCount(),
      getTokensInUse(),
    ])
    return { enabled: true, count, inUse }
  })

export const setTokenCount = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(tokenCountSchema)
  .handler(async ({ data }) => {
    // Refused rather than accepted with leftovers: a racket already carrying a
    // number above the new count would be tagged with a carabiner that
    // officially no longer exists.
    const inUse = await getTokensInUse()
    const highest = inUse.at(-1)
    if (highest !== undefined && highest > data.tokenCount) {
      throw new Error(m.admin_token_count_below_in_use({ token: highest }))
    }
    await prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, tokenCount: data.tokenCount },
      update: { tokenCount: data.tokenCount },
    })
    return { tokenCount: data.tokenCount }
  })
