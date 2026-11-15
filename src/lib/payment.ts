/**
 * Payment details for a finished job: the club's bank account, the amount and
 * a reference, plus the EPC QR code ("GiroCode") payload a banking app reads
 * when the member scans a Zahlschein (SPEC.md §16).
 *
 * Client-safe: the admin form uses the same IBAN/BIC checks as the server.
 */
import { formatIBAN, generate, validateBIC, validateIBAN } from 'eu-payment-qr'

export { formatIBAN }

/** What eu-payment-qr accepts as the remittance reference (line 11). */
export const MAX_REFERENCE_LENGTH = 35
/** EPC069-12: the whole payload, in bytes. */
const MAX_PAYLOAD_BYTES = 331

export type PaymentAccount = {
  recipient: string
  iban: string
  bic: string | null
}

export type PaymentDetails = PaymentAccount & {
  amountCents: number
  reference: string
  /** The text encoded in the QR code. */
  payload: string
}

export function normalizeIban(iban: string) {
  return iban.replace(/\s/g, '').toUpperCase()
}

export function isValidIban(iban: string) {
  return validateIBAN(normalizeIban(iban)).valid
}

export function isValidBic(bic: string) {
  return validateBIC(bic).valid
}

/**
 * Short, readable code for a job: the last 8 characters of its id. Shown in
 * the reference so the controller can find the job from a bank statement.
 */
export function paymentCode(requestId: string) {
  return `RTC-${requestId.slice(-8).toUpperCase()}`
}

/** "RTC-7K3M9Q2A Anna Gruber", the name cut short to fit 35 characters. */
export function paymentReference(requestId: string, memberName: string) {
  return `${paymentCode(requestId)} ${memberName.trim()}`
    .slice(0, MAX_REFERENCE_LENGTH)
    .trim()
}

/** The job code in a pasted reference or search, e.g. "rtc-7k3m9q2a" → that. */
export function findPaymentCode(text: string) {
  const match = /rtc-([a-z0-9]{8})/i.exec(text)
  return match ? `RTC-${match[1].toUpperCase()}` : null
}

export function buildPaymentDetails({
  account,
  amountCents,
  requestId,
  memberName,
}: {
  account: PaymentAccount
  amountCents: number
  requestId: string
  memberName: string
}): PaymentDetails {
  const reference = paymentReference(requestId, memberName)
  const payload = generate({
    recipient: account.recipient,
    iban: account.iban,
    bic: account.bic ?? undefined,
    amount: amountCents / 100,
    reference,
  })
  if (new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) {
    throw new Error('EPC payload exceeds 331 bytes')
  }
  return { ...account, amountCents, reference, payload }
}
