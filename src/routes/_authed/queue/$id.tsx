import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  acceptRequest,
  collectRequest,
  completeRequest,
  getRequest,
  releaseRequest,
} from '#/server/requests.functions'
import { completeInputSchema } from '#/lib/schemas'
import { canTransition } from '#/lib/status'
import { describeString } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import { RequestSummary, RequestTimeline } from '#/components/request-detail'

export const Route = createFileRoute('/_authed/queue/$id')({
  loader: async ({ params }) => ({
    request: await getRequest({ data: { id: params.id } }),
  }),
  component: QueueDetailPage,
})

function QueueDetailPage() {
  const { request } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const accept = useServerFn(acceptRequest)
  const release = useServerFn(releaseRequest)
  const collect = useServerFn(collectRequest)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  // Operators only act on their own claimed jobs; admins can step in anywhere.
  const isMine = request.operator?.id === user.id
  const mayAct = isMine || user.roles.includes('admin')

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <RequestSummary request={request} showRequester />

      <FormError>{error}</FormError>

      <div className="flex flex-wrap gap-2">
        {canTransition(request.status, 'accept') && (
          <Button
            onClick={() => void run(() => accept({ data: { id: request.id } }))}
          >
            {m.queue_accept()}
          </Button>
        )}

        {mayAct && canTransition(request.status, 'complete') && !finishing && (
          <Button onClick={() => setFinishing(true)}>
            {m.queue_complete()}
          </Button>
        )}

        {mayAct && canTransition(request.status, 'release') && (
          <Button
            variant="outline"
            onClick={() =>
              void run(() => release({ data: { id: request.id } }))
            }
          >
            {m.queue_release()}
          </Button>
        )}

        {canTransition(request.status, 'collect') && (
          <Button
            onClick={() =>
              void run(() => collect({ data: { id: request.id } }))
            }
          >
            {m.queue_collect()}
          </Button>
        )}
      </div>

      {finishing && (
        <CompleteForm
          request={request}
          onDone={async () => {
            setFinishing(false)
            await router.invalidate()
          }}
          onCancel={() => setFinishing(false)}
        />
      )}

      <RequestTimeline events={request.events} />
    </div>
  )
}

function CompleteForm({
  request,
  onDone,
  onCancel,
}: {
  request: {
    id: string
    tensionMain: number
    tensionCross: number | null
    stringSource: string
    ownStringName: string | null
    clubString: {
      name: string
      gauge: string | null
      priceCents: number | null
    } | null
  }
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const complete = useServerFn(completeRequest)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    // Prefilled from the request — the operator only edits what actually
    // differed, e.g. a substituted string or a corrected price.
    defaultValues: {
      usedStringName: describeString(request),
      usedTensionMain: String(request.tensionMain),
      usedTensionCross:
        request.tensionCross == null ? '' : String(request.tensionCross),
      stringPriceCents:
        request.clubString?.priceCents == null
          ? ''
          : (request.clubString.priceCents / 100).toFixed(2),
      labourPriceCents: '',
      operatorNotes: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      try {
        await complete({
          data: completeInputSchema.parse({
            id: request.id,
            usedStringName: value.usedStringName,
            usedTensionMain: value.usedTensionMain,
            usedTensionCross:
              value.usedTensionCross === '' ? null : value.usedTensionCross,
            stringPriceCents:
              value.stringPriceCents === ''
                ? null
                : Math.round(Number(value.stringPriceCents) * 100),
            labourPriceCents:
              value.labourPriceCents === ''
                ? null
                : Math.round(Number(value.labourPriceCents) * 100),
            operatorNotes: value.operatorNotes || null,
          }),
        })
        await onDone()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.queue_complete_title()}</CardTitle>
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

          <form.Field name="usedStringName">
            {(field) => (
              <Field
                id={field.name}
                label={m.queue_used_string()}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <form.Field name="usedTensionMain">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.queue_used_tension_main()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="number"
                    step="0.5"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="usedTensionCross">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.queue_used_tension_cross()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="number"
                    step="0.5"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="stringPriceCents">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.queue_string_price()}
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

            <form.Field name="labourPriceCents">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.queue_labour_price()}
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

          <form.Field name="operatorNotes">
            {(field) => (
              <Field
                id={field.name}
                label={m.queue_operator_notes()}
                errors={fieldErrors(field.state.meta)}
              >
                <Textarea
                  id={field.name}
                  rows={2}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <div className="flex gap-2">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.common_saving() : m.queue_complete()}
                </Button>
              )}
            </form.Subscribe>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {m.common_cancel()}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
