import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { memberMiddleware } from '#/lib/auth-middleware'

/**
 * Marks the welcome tour as seen, whether the member walked through it or
 * closed it early — either way it should not open on its own again. Only the
 * first call takes, so `onboardedAt` keeps the date of the first visit; a
 * replay from the dashboard calls this again harmlessly.
 */
export const completeOnboarding = createServerFn({ method: 'POST' })
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    await prisma.user.updateMany({
      where: { id: context.user.id, onboardedAt: null },
      data: { onboardedAt: new Date() },
    })
  })
