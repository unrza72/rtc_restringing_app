/**
 * Unit checks for the payment QR code payload (SPEC.md §16). Pure: this is
 * the text a banking app turns into a transfer, so a wrong line here sends
 * money to the wrong place or with the wrong reference.
 */
import { parse } from 'eu-payment-qr'

import {
  MAX_REFERENCE_LENGTH,
  buildPaymentDetails,
  findPaymentCode,
  isValidBic,
  isValidIban,
  normalizeIban,
  paymentCode,
  paymentReference,
} from '../src/lib/payment.js'

let failures = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}`)
  if (!ok) {
    failures++
    if (detail !== undefined) {
      console.log('      ', JSON.stringify(detail).slice(0, 400))
    }
  }
}

const ACCOUNT = {
  recipient: 'Tennisclub RTC',
  iban: 'AT611904300234573201',
  bic: null,
}
const REQUEST_ID = 'cmh2x9k1a0000abcd7k3m9q2a'

console.log('payload')
{
  const { payload, reference } = buildPaymentDetails({
    account: ACCOUNT,
    amountCents: 3250,
    requestId: REQUEST_ID,
    memberName: 'Anna Gruber',
  })
  const lines = payload.split('\n')
  check(
    'one field per line, EPC069-12 version 002, UTF-8, SCT',
    lines.slice(0, 4).join('|') === 'BCD|002|1|SCT',
    lines,
  )
  check('an empty BIC leaves its line empty', lines[4] === '', lines[4])
  check('recipient on line 6', lines[5] === 'Tennisclub RTC', lines[5])
  check('IBAN on line 7', lines[6] === 'AT611904300234573201', lines[6])
  check('amount with a dot and two decimals', lines[7] === 'EUR32.50', lines[7])
  check(
    'no purpose code, no structured reference',
    lines[8] === '' && lines[9] === '',
    lines,
  )
  check(
    'reference as remittance text on line 11',
    lines[10] === 'RTC-7K3M9Q2A Anna Gruber' && lines[10] === reference,
    lines[10],
  )
  check('nothing after the reference', lines.length === 11, lines.length)
  check(
    'reads back with the same values',
    JSON.stringify(parse(payload).data) ===
      JSON.stringify({
        recipient: 'Tennisclub RTC',
        iban: 'AT611904300234573201',
        amount: 32.5,
        reference,
      }),
    parse(payload),
  )
}
{
  const { payload } = buildPaymentDetails({
    account: { ...ACCOUNT, bic: 'GIBAATWWXXX' },
    amountCents: 1500,
    requestId: REQUEST_ID,
    memberName: 'Jörg Müller-Lüdenscheidt',
  })
  const lines = payload.split('\n')
  check('a BIC goes on line 5', lines[4] === 'GIBAATWWXXX', lines[4])
  check(
    'a whole-euro amount still has two decimals',
    lines[7] === 'EUR15.00',
    lines[7],
  )
  check(
    'umlauts stay within 331 bytes',
    new TextEncoder().encode(payload).length <= 331,
  )
}
{
  const long = 'Maximilian Alexander von und zu Hohenberg-Liechtenstein'
  const reference = paymentReference(REQUEST_ID, long)
  check(
    `a long name is cut to ${MAX_REFERENCE_LENGTH} characters`,
    reference.length <= MAX_REFERENCE_LENGTH,
    reference,
  )
  check(
    'the job code always survives the cut',
    reference.startsWith('RTC-7K3M9Q2A '),
    reference,
  )
  check(
    'no trailing space after the cut',
    reference === reference.trim(),
    reference,
  )
}

console.log('codes')
check(
  'the code is the last 8 id characters, uppercased',
  paymentCode(REQUEST_ID) === 'RTC-7K3M9Q2A',
)
check(
  'found in a pasted reference, any case',
  findPaymentCode('Überweisung rtc-7k3m9q2a Anna') === 'RTC-7K3M9Q2A',
)
check('not found in plain text', findPaymentCode('Anna Gruber') === null)

console.log('account checks')
check(
  'an IBAN with spaces and lowercase is normalized',
  normalizeIban('at61 1904 3002 3457 3201') === 'AT611904300234573201',
)
check('a valid Austrian IBAN passes', isValidIban('AT61 1904 3002 3457 3201'))
check('a valid German IBAN passes', isValidIban('DE89370400440532013000'))
check('a wrong checksum is refused', !isValidIban('AT621904300234573201'))
check('a wrong length is refused', !isValidIban('AT6119043002345732'))
check(
  'an 8- or 11-character BIC passes',
  isValidBic('GIBAATWW') && isValidBic('GIBAATWWXXX'),
)
check('a 9-character BIC is refused', !isValidBic('GIBAATWWX'))
{
  let threw = false
  try {
    buildPaymentDetails({
      account: { ...ACCOUNT, iban: 'AT621904300234573201' },
      amountCents: 100,
      requestId: REQUEST_ID,
      memberName: 'A',
    })
  } catch {
    threw = true
  }
  check('a payload is never built for an invalid IBAN', threw)
}

console.log(
  `\n${failures === 0 ? '✅ all EPC checks passed' : `❌ ${failures} EPC check(s) failed`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
