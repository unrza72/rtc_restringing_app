import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { createRacket } from '#/server/rackets.functions'
import { m } from '#/paraglide/messages'
import { RacketForm } from '#/components/racket-form'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_authed/rackets/new')({
  component: NewRacketPage,
})

function NewRacketPage() {
  const router = useRouter()
  const create = useServerFn(createRacket)

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{m.racket_new_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          <RacketForm
            submitLabel={m.racket_add()}
            onCancel={() =>
              void router.navigate({ to: '/rackets', search: {} })
            }
            onSubmit={async (value) => {
              const racket = await create({ data: value })
              await router.invalidate()
              await router.navigate({
                to: '/rackets/$id',
                params: { id: racket.id },
              })
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
