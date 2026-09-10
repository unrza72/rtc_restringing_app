import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { z } from 'zod'

import { listQueue } from '#/server/requests.functions'
import { REQUEST_STATUSES } from '#/lib/status'
import type { RequestStatus } from '#/lib/status'
import { describeString, formatDate, formatTension } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { StatusBadge } from '#/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

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

type SortKey = 'racket' | 'requester' | 'stringer' | 'neededBy' | 'status'
type SortDir = 'asc' | 'desc'

// Pipeline order, not alphabetical — REQUESTED before ACCEPTED before DONE
// is what "sorted by status" should mean when the open view mixes all three.
const STATUS_ORDER: Record<RequestStatus, number> = Object.fromEntries(
  REQUEST_STATUSES.map((status, i) => [status, i]),
) as Record<RequestStatus, number>

function QueuePage() {
  const { requests } = Route.useLoaderData()
  const search = Route.useSearch()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('neededBy')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? requests.filter((r) =>
          [r.racket.label, r.requester.name, r.operator?.name]
            .filter((v): v is string => !!v)
            .some((v) => v.toLowerCase().includes(q)),
        )
      : requests

    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'racket':
          return dir * a.racket.label.localeCompare(b.racket.label)
        case 'requester':
          return dir * a.requester.name.localeCompare(b.requester.name)
        case 'stringer':
          return (
            dir * (a.operator?.name ?? '').localeCompare(b.operator?.name ?? '')
          )
        case 'status':
          return (
            dir *
            (STATUS_ORDER[a.status as RequestStatus] -
              STATUS_ORDER[b.status as RequestStatus])
          )
        case 'neededBy': {
          // No deadline sorts last regardless of direction — "soonest first"
          // and "latest first" should both put "whenever" at the bottom.
          if (!a.neededBy && !b.neededBy) return 0
          if (!a.neededBy) return 1
          if (!b.neededBy) return -1
          return (
            dir *
            (new Date(a.neededBy).getTime() - new Date(b.neededBy).getTime())
          )
        }
      }
    })
  }, [requests, query, sortKey, sortDir])

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        {m.queue_title()}
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m.queue_search_placeholder()}
            className="pl-8"
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.queue_empty()}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.queue_search_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-2 sm:px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead
                    label={m.request_racket()}
                    active={sortKey === 'racket'}
                    dir={sortDir}
                    onClick={() => toggleSort('racket')}
                  />
                  <SortHead
                    label={m.request_label_requester()}
                    active={sortKey === 'requester'}
                    dir={sortDir}
                    onClick={() => toggleSort('requester')}
                  />
                  <SortHead
                    label={m.request_stringer()}
                    active={sortKey === 'stringer'}
                    dir={sortDir}
                    onClick={() => toggleSort('stringer')}
                  />
                  <SortHead
                    label={m.request_needed_by()}
                    active={sortKey === 'neededBy'}
                    dir={sortDir}
                    onClick={() => toggleSort('neededBy')}
                  />
                  <SortHead
                    label={m.queue_col_status()}
                    active={sortKey === 'status'}
                    dir={sortDir}
                    onClick={() => toggleSort('status')}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        to="/queue/$id"
                        params={{ id: request.id }}
                        className="font-medium text-slate-200 underline-offset-4 hover:underline"
                      >
                        {request.racket.label}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {describeString(request)} ·{' '}
                        {formatTension(
                          request.tensionMain,
                          request.tensionCross,
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{request.requester.name}</TableCell>
                    <TableCell>
                      {request.operator?.name ?? m.request_unassigned()}
                    </TableCell>
                    <TableCell
                      className={cn(request.neededBy && 'text-amber-400')}
                    >
                      {request.neededBy
                        ? formatDate(request.neededBy)
                        : m.common_none()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  const Icon = !active
    ? ChevronsUpDown
    : dir === 'asc'
      ? ChevronUp
      : ChevronDown
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 transition-colors hover:text-slate-100',
          active && 'text-slate-100',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'text-slate-600')} />
      </button>
    </TableHead>
  )
}
