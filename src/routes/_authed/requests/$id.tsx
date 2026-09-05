import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  cancelRequest,
  collectRequest,
  getRequest,
} from '#/server/requests.functions'
import { canTransition } from '#/lib/status'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { FormError } from '#/components/form-field'
import { RequestSummary, RequestTimeline } from '#/components/request-detail'

export const Route = createFileRoute('/_authed/requests/$id')({
  loader: async ({ params }) => ({
    request: await getRequest({ data: { id: params.id } }),
  }),
  component: RequestDetailPage,
})

function RequestDetailPage() {
  const { request } = Route.useLoaderData()
  const router = useRouter()
  const cancel = useServerFn(cancelRequest)
  const collect = useServerFn(collectRequest)
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

  const canCancel =
    request.viewerIsOwner && canTransition(request.status, 'cancel')
  const canCollect = canTransition(request.status, 'collect')

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <RequestSummary request={request} />

      <FormError>{error}</FormError>

      {(canCancel || canCollect) && (
        <div className="flex flex-wrap gap-2">
          {canCollect && (
            <Button
              onClick={() =>
                void run(() => collect({ data: { id: request.id } }))
              }
            >
              {m.queue_collect()}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (!confirm(m.request_cancel_confirm())) return
                void run(() => cancel({ data: { id: request.id } }))
              }}
            >
              {m.request_cancel()}
            </Button>
          )}
        </div>
      )}

      <RequestTimeline events={request.events} />
    </div>
  )
}
