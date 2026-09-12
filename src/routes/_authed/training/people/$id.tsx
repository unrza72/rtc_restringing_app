import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  addAvailability,
  getTrainingPerson,
  removeAvailability,
  updateTrainingPerson,
} from '#/server/training.functions'
import { trainingPersonInputSchema } from '#/lib/schemas'
import {
  BALLS,
  MAX_STRENGTH,
  MIN_STRENGTH,
  PERSON_KINDS,
  WEEKDAYS,
  formatSlot,
  parseMinutes,
} from '#/lib/training'
import type { Ball, PersonKind } from '#/lib/training'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export const Route = createFileRoute('/_authed/training/people/$id')({
  loader: async ({ params }) => ({
    person: await getTrainingPerson({ data: { id: params.id } }),
  }),
  component: PersonPage,
})

function PersonPage() {
  const { person } = Route.useLoaderData()
  const router = useRouter()
  const update = useServerFn(updateTrainingPerson)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: person.name,
      kind: person.kind as PersonKind,
      ball: (person.ball ?? 'YELLOW') as Ball,
      strength: person.strength === null ? '' : String(person.strength),
      notes: person.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        await update({
          data: {
            ...trainingPersonInputSchema.parse({
              name: value.name,
              kind: value.kind,
              ball: value.ball,
              strength: value.strength === '' ? null : value.strength,
              notes: value.notes || null,
            }),
            id: person.id,
          },
        })
        await router.invalidate()
      } catch (e) {
        setError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <div className="grid gap-6">
      <Link
        to="/training/people"
        className="text-sm text-slate-400 underline-offset-4 hover:underline"
      >
        ← {m.common_back()}
      </Link>

      <FormError>{error}</FormError>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {m.training_person_edit()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <form.Field name="name">
                {(field) => (
                  <Field
                    id={field.name}
                    label={m.training_person_name()}
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

              <form.Field name="kind">
                {(field) => (
                  <Field id={field.name} label={m.training_person_kind()}>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => field.handleChange(v as PersonKind)}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSON_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {m[`training_kind_${kind}`]()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Subscribe selector={(s) => s.values.kind}>
                {(kind) =>
                  kind === 'TRAINEE' ? (
                    <>
                      <form.Field name="ball">
                        {(field) => (
                          <Field id={field.name} label={m.training_ball()}>
                            <Select
                              value={field.state.value}
                              onValueChange={(v) =>
                                field.handleChange(v as Ball)
                              }
                            >
                              <SelectTrigger id={field.name} className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BALLS.map((ball) => (
                                  <SelectItem key={ball} value={ball}>
                                    {m[`training_ball_${ball}`]()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      </form.Field>

                      <form.Field name="strength">
                        {(field) => (
                          <Field
                            id={field.name}
                            label={m.training_strength()}
                            hint={m.training_strength_hint()}
                            errors={fieldErrors(field.state.meta)}
                          >
                            <Input
                              id={field.name}
                              type="number"
                              step="0.5"
                              min={MIN_STRENGTH}
                              max={MAX_STRENGTH}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                            />
                          </Field>
                        )}
                      </form.Field>
                    </>
                  ) : null
                }
              </form.Subscribe>

              <form.Field name="notes">
                {(field) => (
                  <Field
                    id={field.name}
                    label={m.training_person_notes()}
                    className="sm:col-span-4"
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
            </div>

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="justify-self-start"
                >
                  {isSubmitting ? m.common_saving() : m.training_person_save()}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <AvailabilityCard
        personId={person.id}
        slots={person.availability}
        onChanged={() => router.invalidate()}
      />
    </div>
  )
}

function AvailabilityCard({
  personId,
  slots,
  onChanged,
}: {
  personId: string
  slots: Array<{
    id: string
    weekday: number
    startMin: number
    endMin: number
  }>
  onChanged: () => Promise<void> | void
}) {
  const add = useServerFn(addAvailability)
  const remove = useServerFn(removeAvailability)
  const [error, setError] = useState<string | null>(null)
  const [weekday, setWeekday] = useState('0')
  const [from, setFrom] = useState('17:00')
  const [to, setTo] = useState('19:00')

  async function handleAdd() {
    setError(null)
    const startMin = parseMinutes(from)
    const endMin = parseMinutes(to)
    if (startMin === null || endMin === null || endMin <= startMin) {
      setError(m.common_error_generic())
      return
    }
    try {
      await add({
        data: { personId, weekday: Number(weekday), startMin, endMin },
      })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await remove({ data: { id } })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  const byDay = WEEKDAYS.map((day) => ({
    day,
    slots: slots.filter((s) => s.weekday === day),
  })).filter((d) => d.slots.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {m.training_availability_title()}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormError>{error}</FormError>

        {byDay.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {m.training_availability_empty()}
          </p>
        ) : (
          <ul className="divide-y">
            {byDay.map(({ day, slots: daySlots }) => (
              <li
                key={day}
                className="flex flex-wrap items-center gap-3 py-2.5"
              >
                <span className="w-28 text-sm font-medium text-slate-300">
                  {m[`training_weekday_${day}`]()}
                </span>
                <span className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <span
                      key={slot.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs"
                    >
                      {formatSlot(slot.startMin, slot.endMin)}
                      <button
                        type="button"
                        onClick={() => void handleRemove(slot.id)}
                        aria-label={m.common_delete()}
                        className="text-slate-500 transition-colors hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-800 pt-4">
          <Field id="avail-day" label={m.training_day()} className="w-40">
            <Select value={weekday} onValueChange={setWeekday}>
              <SelectTrigger id="avail-day" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {m[`training_weekday_${day}`]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="avail-from" label={m.training_from()} className="w-28">
            <Input
              id="avail-from"
              type="time"
              step={300}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>

          <Field id="avail-to" label={m.training_to()} className="w-28">
            <Input
              id="avail-to"
              type="time"
              step={300}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>

          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleAdd()}
          >
            {m.training_availability_add()}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
