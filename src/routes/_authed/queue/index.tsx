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
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
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
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? // The workshop is amber territory throughout the prototype.
            'border-amber-600 bg-amber-600 text-white shadow-md'
          : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200',
      )}
    >
      {label}
    </Link>
  )
}
