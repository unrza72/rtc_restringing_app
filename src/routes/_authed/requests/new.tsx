import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import { listRackets } from '#/server/rackets.functions'
import { listActiveStrings } from '#/server/strings.functions'
import { createRequest } from '#/server/requests.functions'
import { requestInputSchema } from '#/lib/schemas'
import { schemaValidator } from '#/lib/form'
import { formatPrice } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Field, FormError, fieldErrors } from '#/components/form-field'

export const Route = createFileRoute('/_authed/requests/new')({
  loader: async () => ({
    rackets: await listRackets({ data: { includeArchived: false } }),
    strings: await listActiveStrings(),
  }),
  component: NewRequestPage,
})

function NewRequestPage() {
  const { rackets, strings } = Route.useLoaderData()
  const router = useRouter()
  const create = useServerFn(createRequest)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      racketId: rackets[0]?.id ?? '',
      stringSource: strings.length > 0 ? 'CLUB' : 'MEMBER',
      clubStringId: strings[0]?.id ?? '',
      ownStringName: '',
      tensionMain: '24',
      tensionCross: '',
      neededBy: '',
      memberNotes: '',
    },
    validators: {
      // Surfaces the cross-field rules (own string vs catalogue) on the field
      // they belong to instead of as a generic form error.
      onSubmit: schemaValidator(requestInputSchema, normalise),
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      try {
        const request = await create({
          data: requestInputSchema.parse(normalise(value)),
        })
        await router.invalidate()
        await router.navigate({
          to: '/requests/$id',
          params: { id: request.id },
        })
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : m.common_error_generic(),
        )
      }
    },
  })

  if (rackets.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="grid gap-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {m.request_no_rackets()}
          </p>
          <div>
            <Button asChild>
              <Link to="/rackets/new">{m.dash_add_racket()}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{m.request_new_title()}</CardTitle>
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

            <form.Field name="racketId">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.request_racket()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger id={field.name} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rackets.map((racket) => (
                        <SelectItem key={racket.id} value={racket.id}>
                          {racket.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Field name="stringSource">
              {(field) => (
                <Field id={field.name} label={m.request_string_source()}>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    className="gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="CLUB"
                        id="source-club"
                        disabled={strings.length === 0}
                      />
                      <Label htmlFor="source-club" className="font-normal">
                        {m.request_source_club()}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="MEMBER" id="source-member" />
                      <Label htmlFor="source-member" className="font-normal">
                        {m.request_source_member()}
                      </Label>
                    </div>
                  </RadioGroup>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.stringSource}>
              {(source) =>
                source === 'CLUB' ? (
                  <form.Field name="clubStringId">
                    {(field) => (
                      <Field
                        id={field.name}
                        label={m.request_club_string()}
                        hint={
                          strings.length === 0
                            ? m.request_no_strings()
                            : undefined
                        }
                        errors={fieldErrors(field.state.meta)}
                      >
                        <Select
                          value={field.state.value}
                          onValueChange={field.handleChange}
                        >
                          <SelectTrigger id={field.name} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {strings.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {[s.name, s.gauge].filter(Boolean).join(' ')}
                                {s.priceCents != null &&
                                  ` — ${formatPrice(s.priceCents)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>
                ) : (
                  <form.Field name="ownStringName">
                    {(field) => (
                      <Field
                        id={field.name}
                        label={m.request_own_string()}
                        errors={fieldErrors(field.state.meta)}
                      >
                        <Input
                          id={field.name}
                          placeholder="Luxilon ALU Power 1.25"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="tensionMain">
                {(field) => (
                  <Field
                    id={field.name}
                    label={m.request_tension_main()}
                    errors={fieldErrors(field.state.meta)}
                  >
                    <Input
                      id={field.name}
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="tensionCross">
                {(field) => (
                  <Field
                    id={field.name}
                    label={m.request_tension_cross()}
                    hint={m.request_tension_cross_hint()}
                    errors={fieldErrors(field.state.meta)}
                  >
                    <Input
                      id={field.name}
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
            </div>

            <form.Field name="neededBy">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.request_needed_by()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="memberNotes">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.request_notes()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Textarea
                    id={field.name}
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.common_saving() : m.request_submit()}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/** Empty strings from the inputs become the nulls the schema expects. */
function normalise(value: {
  racketId: string
  stringSource: string
  clubStringId: string
  ownStringName: string
  tensionMain: string
  tensionCross: string
  neededBy: string
  memberNotes: string
}) {
  return {
    ...value,
    clubStringId: value.clubStringId || null,
    ownStringName: value.ownStringName || null,
    tensionCross: value.tensionCross === '' ? null : value.tensionCross,
    neededBy: value.neededBy === '' ? null : value.neededBy,
    memberNotes: value.memberNotes || null,
  }
}
