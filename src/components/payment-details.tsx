import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { encode } from 'uqr'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { formatPrice } from '#/lib/labels'
import { formatIBAN } from '#/lib/payment'
import type { PaymentDetails as Payment } from '#/lib/payment'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'

/**
 * How to pay for a finished job (SPEC.md §16): an EPC QR code a banking app
 * fills a transfer from, and each detail with a copy button, since a member
 * can't scan the screen they're looking at. On a phone the copy fields come
 * first; from `sm:` up the QR code sits beside them.
 */
export function PaymentDetails({
  payment,
  memberName,
  forOperator = false,
}: {
  payment: Payment
  memberName: string
  forOperator?: boolean
}) {
  const amount = formatPrice(payment.amountCents)
  const fields = [
    { label: m.payment_recipient(), shown: payment.recipient },
    {
      label: m.payment_iban(),
      shown: formatIBAN(payment.iban),
      copied: payment.iban,
    },
    ...(payment.bic ? [{ label: m.payment_bic(), shown: payment.bic }] : []),
    {
      label: m.payment_amount(),
      shown: amount,
      // What a transfer form's amount field takes: "32,50", no currency sign.
      copied: new Intl.NumberFormat(getLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      }).format(payment.amountCents / 100),
    },
    { label: m.payment_reference(), shown: payment.reference },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{m.payment_title()}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {forOperator
            ? m.payment_intro_operator({ name: memberName })
            : m.payment_intro_member()}
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <dl className="grid min-w-0 gap-3">
          {fields.map((field) => (
            <div key={field.label} className="flex min-w-0 items-end gap-2">
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="font-medium wrap-break-word">{field.shown}</dd>
              </div>
              <CopyButton
                field={field.label}
                value={field.copied ?? field.shown}
              />
            </div>
          ))}
        </dl>
        <QrCode
          payload={payment.payload}
          label={m.payment_qr_label({ amount })}
        />
      </CardContent>
    </Card>
  )
}

function CopyButton({ field, value }: { field: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const label = copied ? m.payment_copied() : m.payment_copy({ field })

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; the value is still selectable text.
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="shrink-0"
      title={label}
      aria-label={label}
      onClick={() => void copy()}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  )
}

/**
 * Drawn as one SVG path from uqr's module grid: no innerHTML and no `data:`
 * image, so the Content-Security-Policy needs nothing extra. Level M error
 * correction, as EPC069-12 requires; a 4-module quiet zone so scanners find
 * the edges; black on white whatever the page around it looks like.
 */
function QrCode({ payload, label }: { payload: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(payload, { ecc: 'M', border: 4 })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { size: qr.size, path: d }
  }, [payload])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="mx-auto aspect-square w-56 max-w-full rounded-md border border-border bg-white"
    >
      <path d={path} fill="#000" />
    </svg>
  )
}
