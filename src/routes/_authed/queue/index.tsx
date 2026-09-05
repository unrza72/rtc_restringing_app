import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { listQueue } from '#/server/requests.functions'
import { REQUEST_STATUSES } from '#/lib/status'
import { m } from '#/paraglide/messages'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'
import { RequestList } from '#/components/request-list'

const searchSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  mine: z.boolean().optional(),
})

export const Route = createFileRoute('/_authed/queue/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    status: search.status ?? null,
    mine: search.mine ?? false,
  }),
  loader: async ({ deps }) => ({
    requests: await listQueue({ data: deps }),
  }),
  component: QueuePage,
})

function QueuePage() {
  const { requests } = Route.useLoaderData()
  const search = Route.useSearch()

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {m.queue_title()}
      </h1>

      <div className="flex flex-wrap gap-2">
        <FilterTab
          label={m.queue_filter_open()}
          to={{ status: undefined, mine: undefined }}
          active={!search.status && !search.mine}
        />
        <FilterTab
          label={m.queue_filter_mine()}
          to={{ status: undefined, mine: true }}
          active={!!search.mine}
        />
        {REQUEST_STATUSES.map((status) => (
          <FilterTab
            key={status}
            label={m[`status_${status}`]()}
            to={{ status, mine: undefined }}
            active={search.status === status}
          />
        ))}
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.queue_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-2">
            <RequestList requests={requests} showRequester linkTo="queue" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FilterTab({
  label,
  to,
  active,
}: {
  label: string
  to: z.infer<typeof searchSchema>
  active: boolean
}) {
  return (
    <Link
      to="/queue"
      search={to}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {label}
    </Link>
  )
}
