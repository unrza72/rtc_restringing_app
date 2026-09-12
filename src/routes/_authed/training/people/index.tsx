import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  createTrainingPerson,
  listTrainingPeople,
  removeTrainingPerson,
  setPersonArchived,
} from '#/server/training.functions'
import { trainingPersonInputSchema } from '#/lib/schemas'
import {
  BALLS,
  BALL_BADGE,
  MAX_STRENGTH,
  MIN_STRENGTH,
  PERSON_KINDS,
} from '#/lib/training'
import type { Ball, PersonKind } from '#/lib/training'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
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
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/training/people/')({
  loader: async () => ({ people: await listTrainingPeople() }),
  component: PeoplePage,
})

type Person = Awaited<ReturnType<typeof listTrainingPeople>>[number]

function PeoplePage() {
  const { people } = Route.useLoaderData()
  const router = useRouter()
  const archive = useServerFn(setPersonArchived)
  const remove = useServerFn(removeTrainingPerson)
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

  const trainers = people.filter((p) => p.kind === 'TRAINER')
  const trainees = people.filter((p) => p.kind === 'TRAINEE')

  return (
    <div className="grid gap-6">
      <FormError>{error}</FormError>

      {people.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.training_people_empty()}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <PersonGroup
            title={m.training_trainers()}
            people={trainers}
            onArchive={(id, archived) =>
              void run(() => archive({ data: { id, archived } }))
            }
            onRemove={(id) => void run(() => remove({ data: { id } }))}
          />
          <PersonGroup
            title={m.training_trainees()}
            people={trainees}
            onArchive={(id, archived) =>
              void run(() => archive({ data: { id, archived } }))
            }
            onRemove={(id) => void run(() => remove({ data: { id } }))}
          />
        </div>
      )}

      <AddPersonCard onCreated={() => router.invalidate()} />
    </div>
  )
}

function PersonGroup({
  title,
  people,
  onArchive,
  onRemove,
}: {
  title: string
  people: Array<Person>
  onArchive: (id: string, archived: boolean) => void
  onRemove: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({people.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        {people.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {m.training_people_empty()}
          </p>
        ) : (
          <ul className="divide-y">
            {people.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
              >
                <Link
                  to="/training/people/$id"
                  params={{ id: person.id }}
                  className={cn(
                    'font-medium text-slate-200 underline-offset-4 hover:underline',
                    person.archived && 'text-slate-500',
                  )}
                >
                  {person.name}
                </Link>

                {person.ball && (
                  <Badge
                    variant="outline"
                    className={BALL_BADGE[person.ball as Ball]}
                  >
                    {m[`training_ball_${person.ball as Ball}`]()}
                  </Badge>
                )}
                {person.strength !== null && (
                  <span className="text-xs text-slate-400">
                    {m.training_strength()} {person.strength}
                  </span>
                )}
                {person.archived && (
                  <Badge variant="outline">
                    {m.training_person_archived()}
                  </Badge>
                )}

                <span className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {m.training_slot_count({
                      count: person.availability.length,
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onArchive(person.id, !person.archived)}
                  >
                    {person.archived
                      ? m.racket_unarchive()
                      : m.racket_archive()}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onRemove(person.id)}
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
  )
}

function AddPersonCard({
  onCreated,
}: {
  onCreated: () => Promise<void> | void
}) {
  const create = useServerFn(createTrainingPerson)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      kind: 'TRAINEE' as PersonKind,
      ball: 'YELLOW' as Ball,
      strength: '2',
      notes: '',
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null)
      try {
        await create({
          data: trainingPersonInputSchema.parse({
            name: value.name,
            kind: value.kind,
            ball: value.ball,
            strength: value.strength === '' ? null : value.strength,
            notes: value.notes || null,
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
        <CardTitle className="text-base">{m.training_person_add()}</CardTitle>
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

          <div className="grid gap-4 sm:grid-cols-5">
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

            {/* Ball and strength are what groups are formed on, so they only
                apply to trainees. */}
            <form.Subscribe selector={(s) => s.values.kind}>
              {(kind) =>
                kind === 'TRAINEE' ? (
                  <>
                    <form.Field name="ball">
                      {(field) => (
                        <Field id={field.name} label={m.training_ball()}>
                          <Select
                            value={field.state.value}
                            onValueChange={(v) => field.handleChange(v as Ball)}
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
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </>
                ) : null
              }
            </form.Subscribe>
          </div>

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="justify-self-start"
              >
                {isSubmitting ? m.common_saving() : m.training_person_add()}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}
