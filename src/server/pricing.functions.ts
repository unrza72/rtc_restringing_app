import { createServerFn } from '@tanstack/react-start'

import { prisma } from '#/db'
import { adminMiddleware, memberMiddleware } from '#/lib/auth-middleware'
import { getClubPricing } from '#/lib/pricing.server'
import { getPaymentAccount } from '#/lib/payment.server'
import { paymentAccountSchema, pricingSchema } from '#/lib/schemas'

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

/** The club's bank account for payment QR codes (SPEC.md §16), for the admin form. */
export const getPaymentAccountSettings = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(() => getPaymentAccount())

/** Recipient and IBAN together, or both empty to switch payment details off. */
export const setPaymentAccount = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(paymentAccountSchema)
  .handler(async ({ data }) => {
    const columns = {
      paymentRecipient: data.recipient,
      paymentIban: data.iban,
      paymentBic: data.bic,
    }
    await prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...columns },
      update: columns,
    })
    return data
  })
