import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { adminMiddleware, memberMiddleware } from '#/lib/auth-middleware'
import { getClubPricing } from '#/lib/pricing.server'
import { pricingSchema } from '#/lib/schemas'

/** Public club prices — the request form shows members what they'll pay. */
export const getPricing = createServerFn({ method: 'GET' })
  .middleware([memberMiddleware])
  .handler(() => getClubPricing())

/** Applies to jobs marked done from now on; finished ones keep their price. */
export const setPricing = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(pricingSchema)
  .handler(async ({ data }) => {
    await prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    })
    return data
  })
