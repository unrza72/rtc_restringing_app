import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'

import {
  createClubString,
  listAllStrings,
  removeClubString,
  updateClubString,
} from '#/server/strings.functions'
import { getTokenStatus, setTokenCount } from '#/server/tokens.functions'
import { getPricing, setPricing } from '#/server/pricing.functions'
import {
  clubStringInputSchema,
  pricingSchema,
  tokenCountSchema,
} from '#/lib/schemas'
import { formatTokenRanges } from '#/lib/tokens'
import { formatPrice } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FormError, fieldErrors } from '#/components/form-field'

export const Route = createFileRoute('/_authed/admin/strings')({
  loader: async () => ({
    strings: await listAllStrings(),
    tokens: await getTokenStatus(),
    pricing: await getPricing(),
  }),
  component: StringsPage,
})

function StringsPage() {
  const { strings, tokens, pricing } = Route.useLoaderData()
  const router = useRouter()
  const update = useServerFn(updateClubString)
  const remove = useServerFn(removeClubString)
  const [error, setError] = useState<string | null>(null)
  // One row at a time turns into the edit form.
  const [editingId, setEditingId] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl text-foreground">{m.admin_strings_title()}</h1>

      <FormError>{error}</FormError>

      <PricingCard pricing={pricing} onSaved={() => router.invalidate()} />

      {tokens.enabled && (
        <TokenCountCard
          count={tokens.count}
          inUse={tokens.inUse}
          onSaved={() => router.invalidate()}
        />
      )}

      <Card>
        <CardContent className="py-2">
          {strings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {m.admin_strings_empty()}
            </p>
          ) : (
            <ul className="divide-y">
              {strings.map((s) =>
                editingId === s.id ? (
                  <li key={s.id} className="py-4">
                    <StringForm
                      defaultValues={{
                        name: s.name,
                        gauge: s.gauge ?? '',
                        priceEuros:
                          s.priceCents == null
                            ? ''
                            : (s.priceCents / 100).toFixed(2),
                      }}
                      submitLabel={m.common_save()}
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (fields) => {
                        await update({
                          data: {
                            ...fields,
                            id: s.id,
                            sortOrder: s.sortOrder,
                            active: s.active,
                          },
                        })
                        setEditingId(null)
                        await router.invalidate()
                      }}
                    />
                  </li>
                ) : (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.gauge && (
                      <span className="text-sm text-muted-foreground">
                        {s.gauge}
                      </span>
                    )}
                    <span className="text-sm">{formatPrice(s.priceCents)}</span>
                    {!s.active && (
                      <Badge variant="outline">
                        {m.member_status_REJECTED()}
                      </Badge>
                    )}

                    {/* Three labelled buttons are wider than a phone, so there
                        they shrink to icons (the label stays for screen readers
                        and as a tooltip) and share a line with the count. */}
                    <span className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
                      <span className="mr-auto text-xs whitespace-nowrap text-muted-foreground sm:mr-0">
                        {m.admin_string_used({ count: s._count.requests })}
                      </span>
                      <span className="flex">
                        <Button
                          size="sm"
                          variant="ghost"
                          title={m.common_edit()}
                          onClick={() => setEditingId(s.id)}
                        >
                          <Pencil />
                          <ActionLabel>{m.common_edit()}</ActionLabel>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title={
                            s.active ? m.racket_archive() : m.racket_unarchive()
                          }
                          onClick={() =>
                            void run(() =>
                              update({
                                data: {
                                  id: s.id,
                                  name: s.name,
                                  gauge: s.gauge,
                                  priceCents: s.priceCents,
                                  sortOrder: s.sortOrder,
                                  active: !s.active,
                                },
                              }),
                            )
                          }
                        >
                          {s.active ? <Archive /> : <ArchiveRestore />}
                          <ActionLabel>
                            {s.active
                              ? m.racket_archive()
                              : m.racket_unarchive()}
                          </ActionLabel>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          title={m.common_delete()}
                          onClick={() =>
                            void run(() => remove({ data: { id: s.id } }))
                          }
                        >
                          <Trash2 />
                          <ActionLabel>{m.common_delete()}</ActionLabel>
                        </Button>
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewStringCard onCreated={() => router.invalidate()} />
    </div>
  )
}

/** A row button's text: read out everywhere, shown from `sm` up. */
function ActionLabel({ children }: { children: string }) {
  return <span className="sr-only sm:not-sr-only">{children}</span>
}

function NewStringCard({
  onCreated,
}: {
  onCreated: () => Promise<void> | void
}) {
  const create = useServerFn(createClubString)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{m.admin_string_add()}</CardTitle>
      </CardHeader>
      <CardContent>
        <StringForm
          submitLabel={m.admin_string_add()}
          resetOnSubmit
          onSubmit={async (fields) => {
            await create({ data: { ...fields, sortOrder: 0, active: true } })
            await onCreated()
          }}
        />
      </CardContent>
    </Card>
  )
}

type StringFormValues = { name: string; gauge: string; priceEuros: string }

/**
 * Name, gauge and price of a catalogue string — adding one and editing one in
 * place share it. Finished jobs keep the name and price they were strung with,
 * so an edit only changes what open requests and new ones show.
 */
function StringForm({
  defaultValues = { name: '', gauge: '', priceEuros: '' },
  submitLabel,
  resetOnSubmit = false,
  onSubmit,
  onCancel,
}: {
  defaultValues?: StringFormValues
  submitLabel: string
  resetOnSubmit?: boolean
  onSubmit: (fields: {
    name: string
    gauge: string | null
    priceCents: number | null
  }) => Promise<void>
  onCancel?: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      setFormError(null)
      // safeParse: a thrown ZodError's message is its raw issue list.
      const parsed = clubStringInputSchema.safeParse({
        name: value.name,
        gauge: value.gauge || null,
        priceCents:
          value.priceEuros === ''
            ? null
            : Math.round(Number(value.priceEuros) * 100),
      })
      if (!parsed.success) {
        setFormError(
          parsed.error.issues[0]?.message ?? m.common_error_generic(),
        )
        return
      }
      try {
        const { name, gauge, priceCents } = parsed.data
        await onSubmit({ name, gauge, priceCents })
        if (resetOnSubmit) formApi.reset()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FormError>{formError}</FormError>

      <div className="grid gap-4 sm:grid-cols-4">
        <form.Field name="name">
          {(field) => (
            <Field
              id={field.name}
              label={m.admin_string_name()}
              className="sm:col-span-2"
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

        <form.Field name="gauge">
          {(field) => (
            <Field
              id={field.name}
              label={m.admin_string_gauge()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                placeholder="1.25"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="priceEuros">
          {(field) => (
            <Field
              id={field.name}
              label={m.admin_string_price()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                type="number"
                step="0.01"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>
      </div>

      <div className="flex gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? m.common_saving() : submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {m.common_cancel()}
          </Button>
        )}
      </div>
    </form>
  )
}

/**
 * How many numbered carabiners the clubhouse has. Lowering it below one that
 * is on a racket right now is refused by setTokenCount.
 */
function TokenCountCard({
  count,
  inUse,
  onSaved,
}: {
  count: number
  inUse: Array<number>
  onSaved: () => Promise<void>
}) {
  const save = useServerFn(setTokenCount)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm({
    defaultValues: { tokenCount: String(count) },
    onSubmit: async ({ value }) => {
      setError(null)
      setSaved(false)
      // safeParse: a thrown ZodError's message is its raw issue list.
      const parsed = tokenCountSchema.safeParse(value)
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? m.common_error_generic())
        return
      }
      try {
        await save({ data: parsed.data })
        setSaved(true)
        await onSaved()
      } catch (e) {
        setError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{m.admin_tokens_title()}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="tokenCount">
            {(field) => (
              <Field
                id={field.name}
                label={m.admin_token_count()}
                className="w-full sm:w-auto"
                hint={
                  inUse.length > 0
                    ? m.admin_token_count_hint({
                        inUse: formatTokenRanges(inUse),
                      })
                    : m.admin_token_count_none_in_use()
                }
              >
                <Input
                  id={field.name}
                  type="number"
                  inputMode="numeric"
                  className="w-32"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSaved(false)
                    field.handleChange(e.target.value)
                  }}
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? m.common_saving() : m.common_save()}
              </Button>
            )}
          </form.Subscribe>
          {saved && (
            <span role="status" className="text-sm text-sage-800">
              {m.admin_token_count_saved()}
            </span>
          )}
        </form>
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}

/** Cents as the "12.50" an input shows; blank when not set. */
function centsToInput(cents: number | null) {
  return cents == null ? '' : (cents / 100).toFixed(2)
}

function inputToCents(value: string) {
  return value.trim() === '' ? null : Math.round(Number(value) * 100)
}

/**
 * The club's flat prices: labour per racket — the same for every stringer, so
 * it lives here instead of on the "mark as done" form — and the extra fee when
 * a member brings their own string.
 */
function PricingCard({
  pricing,
  onSaved,
}: {
  pricing: { labourPriceCents: number | null; ownStringFeeCents: number | null }
  onSaved: () => Promise<void>
}) {
  const save = useServerFn(setPricing)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm({
    defaultValues: {
      labourPrice: centsToInput(pricing.labourPriceCents),
      ownStringFee: centsToInput(pricing.ownStringFeeCents),
    },
    onSubmit: async ({ value }) => {
      setError(null)
      setSaved(false)
      // safeParse: a thrown ZodError's message is its raw issue list.
      const parsed = pricingSchema.safeParse({
        labourPriceCents: inputToCents(value.labourPrice),
        ownStringFeeCents: inputToCents(value.ownStringFee),
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? m.common_error_generic())
        return
      }
      try {
        await save({ data: parsed.data })
        setSaved(true)
        await onSaved()
      } catch (e) {
        setError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  const priceField = (
    name: 'labourPrice' | 'ownStringFee',
    label: string,
    hint: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Field id={field.name} label={label} hint={hint}>
          <Input
            id={field.name}
            type="number"
            step="0.01"
            inputMode="decimal"
            className="w-32"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => {
              setSaved(false)
              field.handleChange(e.target.value)
            }}
          />
        </Field>
      )}
    </form.Field>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{m.admin_pricing_title()}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {priceField(
              'labourPrice',
              m.admin_labour_price(),
              m.admin_labour_price_hint(),
            )}
            {priceField(
              'ownStringFee',
              m.admin_own_string_fee(),
              m.admin_own_string_fee_hint(),
            )}
          </div>
          <div className="flex items-center gap-3">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.common_saving() : m.common_save()}
                </Button>
              )}
            </form.Subscribe>
            {saved && (
              <span role="status" className="text-sm text-sage-800">
                {m.admin_token_count_saved()}
              </span>
            )}
          </div>
        </form>
        <FormError>{error}</FormError>
      </CardContent>
    </Card>
  )
}
