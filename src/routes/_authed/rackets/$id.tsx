import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  deleteRacket,
  getRacket,
  updateRacket,
} from '#/server/rackets.functions'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { RacketForm } from '#/components/racket-form'
import { FormError } from '#/components/form-field'
import { RequestList } from '#/components/request-list'

export const Route = createFileRoute('/_authed/rackets/$id')({
  loader: async ({ params }) => ({
    racket: await getRacket({ data: { id: params.id } }),
  }),
  component: RacketDetailPage,
})

function RacketDetailPage() {
  const { racket } = Route.useLoaderData()
  const router = useRouter()
  const update = useServerFn(updateRacket)
  const remove = useServerFn(deleteRacket)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleteError(null)
    try {
      await remove({ data: { id: racket.id } })
      await router.invalidate()
      await router.navigate({ to: '/rackets', search: {} })
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : m.racket_delete_blocked(),
      )
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{m.racket_edit_title()}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RacketForm
            submitLabel={m.common_save()}
            defaultValues={{
              label: racket.label,
              brand: racket.brand ?? '',
              model: racket.model ?? '',
              headSizeCm2: racket.headSizeCm2?.toString() ?? '',
              stringPattern: racket.stringPattern ?? '',
              gripSize: racket.gripSize ?? '',
              notes: racket.notes ?? '',
            }}
            onSubmit={async (value) => {
              await update({ data: { ...value, id: racket.id } })
              await router.invalidate()
            }}
          />

          <div className="border-t pt-4">
            <FormError>{deleteError}</FormError>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => void handleDelete()}
            >
              {m.common_delete()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.racket_history()}</CardTitle>
        </CardHeader>
        <CardContent>
          {racket.requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.racket_no_history()}
            </p>
          ) : (
            <RequestList
              requests={racket.requests.map((r) => ({
                ...r,
                racket: { label: racket.label },
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
