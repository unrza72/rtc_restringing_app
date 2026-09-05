import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  createClubString,
  listAllStrings,
  removeClubString,
  updateClubString,
} from '#/server/strings.functions'
import { clubStringInputSchema } from '#/lib/schemas'
import { formatPrice } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FormError, fieldErrors } from '#/components/form-field'

export const Route = createFileRoute('/_authed/admin/strings')({
  loader: async () => ({ strings: await listAllStrings() }),
  component: StringsPage,
})

function StringsPage() {
  const { strings } = Route.useLoaderData()
  const router = useRouter()
  const update = useServerFn(updateClubString)
  const remove = useServerFn(removeClubString)
  const [error, setError] = useState<string | null>(null)

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
      <h1 className="text-2xl font-semibold tracking-tight">
        {m.admin_strings_title()}
      </h1>

      <FormError>{error}</FormError>

      <Card>
        <CardContent className="py-2">
          {strings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {m.admin_strings_empty()}
            </p>
          ) : (
            <ul className="divide-y">
              {strings.map((s) => (
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

                  <span className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {m.admin_string_used({ count: s._count.requests })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
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
                      {s.active ? m.racket_archive() : m.racket_unarchive()}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        void run(() => remove({ data: { id: s.id } }))
                      }
                    >
                      {m.common_delete()}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewStringCard onCreated={() => router.invalidate()} />
    </div>
  )
}

function NewStringCard({
  onCreated,
}: {
  onCreated: () => Promise<void> | void
}) {
  const create = useServerFn(createClubString)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', gauge: '', priceEuros: '', sortOrder: '0' },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null)
      try {
        await create({
          data: clubStringInputSchema.parse({
            name: value.name,
            gauge: value.gauge || null,
            priceCents:
              value.priceEuros === ''
                ? null
                : Math.round(Number(value.priceEuros) * 100),
            sortOrder: value.sortOrder || 0,
            active: true,
          }),
        })
        formApi.reset()
        await onCreated()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.admin_string_add()}</CardTitle>
      </CardHeader>
      <CardContent>
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

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="justify-self-start"
              >
                {isSubmitting ? m.common_saving() : m.admin_string_add()}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}
