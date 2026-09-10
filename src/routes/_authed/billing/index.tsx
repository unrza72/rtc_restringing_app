import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  listBillableRequests,
  setRequestPaid,
} from '#/server/requests.functions'
import { formatDate, formatPrice, totalPriceCents } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { FormError } from '#/components/form-field'
import { Badge } from '#/components/ui/badge'
import { SortableHead, useTableSort } from '#/components/sortable-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/billing/')({
  loader: async () => ({ requests: await listBillableRequests() }),
  component: BillingPage,
})

type SortKey =
  | 'racket'
  | 'member'
  | 'stringer'
  | 'stringPrice'
  | 'labourPrice'
  | 'totalPrice'
  | 'paid'

function BillingPage() {
  const { requests } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const setPaid = useServerFn(setRequestPaid)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Unsorted by default keeps the server's most-recently-completed-first
  // order, which is meaningful on its own even though there's no dedicated
  // "completed on" column to sort by directly.
  const { sortKey, sortDir, toggleSort } = useTableSort<SortKey>(null)

  // Toggling paid is a controller (or admin, via the role cascade) action —
  // everyone who can see this page can see who owes what either way.
  const canTogglePaid = user.roles.includes('controller')

  async function togglePaid(id: string, paid: boolean) {
    setError(null)
    setPendingId(id)
    try {
      await setPaid({ data: { id, paid } })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    } finally {
      setPendingId(null)
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

    if (!sortKey) return filtered

    const dir = sortDir === 'asc' ? 1 : -1
    // A job with no price/payment recorded yet sorts last regardless of
    // direction — "highest first" and "lowest first" should both put
    // "not entered" at the bottom, same convention as the queue's due date.
    const nullsLast = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0
      if (a == null) return 1
      if (b == null) return -1
      return dir * (a - b)
    }

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'racket':
          return dir * a.racket.label.localeCompare(b.racket.label)
        case 'member':
          return dir * a.requester.name.localeCompare(b.requester.name)
        case 'stringer':
          return (
            dir * (a.operator?.name ?? '').localeCompare(b.operator?.name ?? '')
          )
        case 'stringPrice':
          return nullsLast(a.stringPriceCents, b.stringPriceCents)
        case 'labourPrice':
          return nullsLast(a.labourPriceCents, b.labourPriceCents)
        case 'totalPrice':
          return nullsLast(
            totalPriceCents(a.stringPriceCents, a.labourPriceCents),
            totalPriceCents(b.stringPriceCents, b.labourPriceCents),
          )
        case 'paid':
          return nullsLast(
            a.paidAt ? new Date(a.paidAt).getTime() : null,
            b.paidAt ? new Date(b.paidAt).getTime() : null,
          )
      }
    })
  }, [requests, query, sortKey, sortDir])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {m.billing_title()}
        </h1>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m.billing_search_placeholder()}
            className="pl-8"
          />
        </div>
      </div>

      <FormError>{error}</FormError>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.billing_empty()}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.billing_search_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-2 sm:px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label={m.request_racket()}
                    sortKey="racket"
                    active={sortKey === 'racket'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHead
                    label={m.billing_col_member()}
                    sortKey="member"
                    active={sortKey === 'member'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHead
                    label={m.request_stringer()}
                    sortKey="stringer"
                    active={sortKey === 'stringer'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHead
                    label={m.request_string_price()}
                    sortKey="stringPrice"
                    active={sortKey === 'stringPrice'}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHead
                    label={m.request_labour_price()}
                    sortKey="labourPrice"
                    active={sortKey === 'labourPrice'}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHead
                    label={m.request_total_price()}
                    sortKey="totalPrice"
                    active={sortKey === 'totalPrice'}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="text-right"
                  />
                  <SortableHead
                    label={m.billing_paid()}
                    sortKey="paid"
                    active={sortKey === 'paid'}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  {canTogglePaid && <TableCell />}
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
                        {request.usedStringName}
                      </div>
                    </TableCell>
                    <TableCell>{request.requester.name}</TableCell>
                    <TableCell>
                      {request.operator?.name ?? m.request_unassigned()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(request.stringPriceCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(request.labourPriceCents)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-100">
                      {formatPrice(
                        totalPriceCents(
                          request.stringPriceCents,
                          request.labourPriceCents,
                        ),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          request.paidAt
                            ? 'border-emerald-500 bg-emerald-950 text-emerald-200'
                            : 'border-slate-700 bg-slate-800 text-slate-300',
                        )}
                      >
                        {request.paidAt
                          ? m.billing_paid_on({
                              date: formatDate(request.paidAt),
                            })
                          : m.billing_unpaid()}
                      </Badge>
                    </TableCell>
                    {canTogglePaid && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingId === request.id}
                          onClick={() =>
                            void togglePaid(request.id, !request.paidAt)
                          }
                        >
                          {request.paidAt
                            ? m.billing_mark_unpaid()
                            : m.billing_mark_paid()}
                        </Button>
                      </TableCell>
                    )}
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
