import { useForm } from '@tanstack/react-form'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { racketInputSchema } from '#/lib/schemas'
import type { RacketInput } from '#/lib/schemas'
import { schemaValidator } from '#/lib/form'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import { cn } from '#/lib/utils'

export type RacketFormValues = {
  label: string
  brand: string
  model: string
  headSizeCm2: string
  stringPattern: string
  gripSize: string
  notes: string
}

export const emptyRacket: RacketFormValues = {
  label: '',
  brand: '',
  model: '',
  headSizeCm2: '',
  stringPattern: '',
  gripSize: '',
  notes: '',
}

/** Whether any of the optional fields already carry a value. */
function hasDetails(value: RacketFormValues) {
  return (
    value.brand !== '' ||
    value.model !== '' ||
    value.headSizeCm2 !== '' ||
    value.stringPattern !== '' ||
    value.gripSize !== '' ||
    value.notes !== ''
  )
}

export function RacketForm({
  defaultValues = emptyRacket,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: RacketFormValues
  submitLabel: string
  onSubmit: (value: RacketInput) => Promise<void>
  onCancel?: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  // Editing an existing racket shows its details right away; adding a new one
  // starts with just the name and lets the rest stay out of the way.
  const [detailsOpen, setDetailsOpen] = useState(() =>
    hasDetails(defaultValues),
  )

  const form = useForm({
    defaultValues,
    validators: { onSubmit: schemaValidator(racketInputSchema, normalise) },
    onSubmit: async ({ value }) => {
      setFormError(null)
      try {
        await onSubmit(racketInputSchema.parse(normalise(value)))
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : m.common_error_generic(),
        )
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

      <form.Field name="label">
        {(field) => (
          <Field
            id={field.name}
            label={m.racket_label()}
            hint={m.racket_label_hint()}
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

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            detailsOpen && 'rotate-180',
          )}
        />
        {detailsOpen ? m.racket_hide_details() : m.racket_add_details()}
      </button>

      {detailsOpen && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="brand">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.racket_brand()}
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

            <form.Field name="model">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.racket_model()}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <form.Field name="headSizeCm2">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.racket_head_size()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="number"
                    inputMode="numeric"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="stringPattern">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.racket_string_pattern()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    placeholder="16x19"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="gripSize">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.racket_grip_size()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    placeholder="L2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <Field
                id={field.name}
                label={m.racket_notes()}
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
        </div>
      )}

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

/** Blank inputs mean "not set", which the schema expects as null. */
function normalise(value: RacketFormValues) {
  return {
    label: value.label,
    brand: value.brand || null,
    model: value.model || null,
    headSizeCm2: value.headSizeCm2 === '' ? null : value.headSizeCm2,
    stringPattern: value.stringPattern || null,
    gripSize: value.gripSize || null,
    notes: value.notes || null,
  }
}
