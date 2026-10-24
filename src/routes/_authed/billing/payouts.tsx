import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  listLabourBalances,
  listReimbursements,
  recordReimbursement,
} from '#/server/payouts.functions'
import { requireRole } from '#/lib/guards'
import { recordReimbursementSchema } from '#/lib/schemas'
import { formatDateTime, formatPrice } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

type Balance = {
  operatorId: string
  name: string
  earnedCents: number
  reimbursedCents: number
  outstandingCents: number
}

/**
 * Narrower than /billing itself: a plain stringer can see job prices there,
 * but who has been paid out how much is controller (or admin) territory only.
 */
export const Route = createFileRoute('/_authed/billing/payouts')({
  beforeLoad: ({ context, location }) => {
    requireRole(context.user, 'controller', location.href)
  },
  loader: async () => ({
    balances: await listLabourBalances(),
    reimbursements: await listReimbursements(),
  }),
  component: PayoutsPage,
})

function PayoutsPage() {
  const { balances, reimbursements } = Route.useLoaderData()
  const router = useRouter()
  const [reimbursing, setReimbursing] = useState<Balance | null>(null)

  return (
    <div className="grid gap-6">
      <h1 className="min-w-0 text-3xl wrap-break-word hyphens-auto text-foreground">
        {m.payouts_title()}
      </h1>

      {balances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.payouts_empty()}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Phones get one card per stringer; the table is for wider screens. */}
          <ul className="grid gap-3 md:hidden">
            {balances.map((balance) => (
              <li
                key={balance.operatorId}
                className="grid gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
              >
                <span className="font-semibold wrap-break-word text-foreground">
                  {balance.name}
                </span>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <Amount
                    label={m.payouts_earned()}
                    cents={balance.earnedCents}
                  />
                  <Amount
                    label={m.payouts_reimbursed()}
                    cents={balance.reimbursedCents}
                  />
                  <Amount
                    label={m.payouts_outstanding()}
                    cents={balance.outstandingCents}
                    strong
                  />
                </dl>
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  disabled={balance.outstandingCents <= 0}
                  onClick={() => setReimbursing(balance)}
                >
                  {m.payouts_reimburse()}
                </Button>
              </li>
            ))}
          </ul>

          {/* min-w-0: without it the table's width stretches the page instead
            of scrolling inside its own container. */}
          <Card className="hidden min-w-0 md:block">
            <CardContent className="px-0 py-2 sm:px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.request_stringer()}</TableHead>
                    <TableHead className="text-right">
                      {m.payouts_earned()}
                    </TableHead>
                    <TableHead className="text-right">
                      {m.payouts_reimbursed()}
                    </TableHead>
                    <TableHead className="text-right">
                      {m.payouts_outstanding()}
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.operatorId}>
                      <TableCell className="font-medium text-foreground">
                        {balance.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(balance.earnedCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(balance.reimbursedCents)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatPrice(balance.outstandingCents)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={balance.outstandingCents <= 0}
                          onClick={() => setReimbursing(balance)}
                        >
                          {m.payouts_reimburse()}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="min-w-0">
        <CardContent className="px-0 py-2 sm:px-2">
          <div className="px-4 pt-4 pb-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase sm:px-2">
            {m.payouts_history()}
          </div>
          {reimbursements.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-2">
              {m.payouts_history_empty()}
            </p>
          ) : (
            <>
              {/* On a phone, one entry per line instead of five columns. */}
              <ul className="divide-y px-4 pb-2 md:hidden">
                {reimbursements.map((entry) => (
                  <li key={entry.id} className="grid gap-0.5 py-3 text-sm">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 font-medium wrap-break-word text-foreground">
                        {entry.operator.name}
                      </span>
                      <span className="ml-auto shrink-0 font-semibold text-foreground">
                        {formatPrice(entry.amountCents)}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="wrap-break-word text-muted-foreground">
                        {entry.note}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {entry.createdBy.name} · {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.request_stringer()}</TableHead>
                      <TableHead className="text-right">
                        {m.payouts_amount()}
                      </TableHead>
                      <TableHead>{m.payouts_note()}</TableHead>
                      <TableHead>{m.payouts_recorded_by()}</TableHead>
                      <TableHead>{m.payouts_recorded_on()}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reimbursements.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.operator.name}</TableCell>
                        <TableCell className="text-right">
                          {formatPrice(entry.amountCents)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.note}
                        </TableCell>
                        <TableCell>{entry.createdBy.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ReimburseDialog
        balance={reimbursing}
        onClose={() => setReimbursing(null)}
        onDone={async () => {
          setReimbursing(null)
          await router.invalidate()
        }}
      />
    </div>
  )
}

/** One figure of a stringer's balance on the phone card. */
function Amount({
  label,
  cents,
  strong = false,
}: {
  label: string
  cents: number
  strong?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="wrap-break-word hyphens-auto text-muted-foreground">
        {label}
      </dt>
      <dd
        className={strong ? 'text-sm font-semibold text-foreground' : 'text-sm'}
      >
        {formatPrice(cents)}
      </dd>
    </div>
  )
}

function ReimburseDialog({
  balance,
  onClose,
  onDone,
}: {
  balance: Balance | null
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const record = useServerFn(recordReimbursement)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { amountCents: '', note: '' },
    onSubmit: async ({ value }) => {
      if (!balance) return
      setFormError(null)
      try {
        await record({
          data: recordReimbursementSchema.parse({
            operatorId: balance.operatorId,
            amountCents: Math.round(Number(value.amountCents) * 100),
            note: value.note,
          }),
        })
        form.reset()
        await onDone()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <Dialog
      open={balance !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {balance && m.payouts_reimburse_title({ name: balance.name })}
          </DialogTitle>
        </DialogHeader>

        {balance && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FormError>{formError}</FormError>

            <p className="text-sm text-muted-foreground">
              {m.payouts_outstanding_hint({
                amount: formatPrice(balance.outstandingCents),
              })}
            </p>

            <form.Field name="amountCents">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.payouts_amount()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="number"
                    step="0.01"
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="note">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.payouts_note()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                {m.common_cancel()}
              </Button>
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? m.common_saving() : m.payouts_reimburse()}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
