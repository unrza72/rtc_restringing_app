import { prisma } from '#/db'
import { totalPriceCents } from '#/lib/labels'
import { buildPaymentDetails } from '#/lib/payment'
import type { PaymentAccount } from '#/lib/payment'

/**
 * The club's bank account, or null while recipient or IBAN is missing, which
 * switches payment details off everywhere. Server-only.
 */
export async function getPaymentAccount(): Promise<PaymentAccount | null> {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 1 } })
  if (!settings?.paymentRecipient || !settings.paymentIban) return null
  return {
    recipient: settings.paymentRecipient,
    iban: settings.paymentIban,
    bic: settings.paymentBic,
  }
}

/**
 * What to pay for one job, or null when there is nothing to pay yet: the
 * price is fixed only once the job is done (§5a), and a paid job is settled.
 * The one place that decides whether payment details are shown (§16).
 */
export async function paymentDetailsFor(request: {
  id: string
  status: string
  paidAt: Date | null
  stringPriceCents: number | null
  labourPriceCents: number | null
  rakeCents: number | null
  requester: { name: string }
}) {
  if (!['DONE', 'COLLECTED'].includes(request.status)) return null
  if (request.paidAt) return null
  const amountCents = totalPriceCents(
    request.stringPriceCents,
    request.labourPriceCents,
    request.rakeCents,
  )
  if (!amountCents || amountCents <= 0) return null
  const account = await getPaymentAccount()
  if (!account) return null
  return buildPaymentDetails({
    account,
    amountCents,
    requestId: request.id,
    memberName: request.requester.name,
  })
}
