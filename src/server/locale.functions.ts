import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { authedMiddleware } from '#/lib/auth-middleware'
import { localeInputSchema } from '#/lib/schemas'

/**
 * A signed-in member's language follows them across devices. Deliberately not
 * gated on approval (memberMiddleware) — even a PENDING user sees the header's
 * locale toggle and the /pending screen, and both should work in their language.
 */

/** Explicit choice — the header toggle always overwrites. */
export const setMyLocale = createServerFn({ method: 'POST' })
  .middleware([authedMiddleware])
  .validator(localeInputSchema)
  .handler(async ({ context, data }) => {
    await prisma.user.update({
      where: { id: context.user.id },
      data: { locale: data.locale },
    })
    return { locale: data.locale }
  })

/**
 * Ambient capture, called after every login/signup with whatever locale the
 * page happened to be in — but only takes if nothing was recorded yet, so it
 * can never clobber a preference the user set explicitly on another device.
 */
export const recordInitialLocale = createServerFn({ method: 'POST' })
  .middleware([authedMiddleware])
  .validator(localeInputSchema)
  .handler(async ({ context, data }) => {
    await prisma.user.updateMany({
      where: { id: context.user.id, locale: null },
      data: { locale: data.locale },
    })
  })
