import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  listBillableRequests,
  setRequestPaid,
} from '#/server/requests.functions'
import { requireAnyRole } from '#/lib/guards'
import { formatDate, formatPrice, totalPriceCents } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { FormError } from '#/components/form-field'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

/** Stringers, controllers and admins — the last two via the role cascade. */
export const Route = createFileRoute('/_authed/billing')({
  beforeLoad: ({ context, location }) => {
    requireAnyRole(context.user, ['operator', 'controller'], location.href)
  },
  loader: async () => ({ requests: await listBillableRequests() }),
  component: BillingPage,
})

function BillingPage() {
  const { requests } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const setPaid = useServerFn(setRequestPaid)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

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

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        {m.billing_title()}
      </h1>

      <FormError>{error}</FormError>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.billing_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-2 sm:px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.request_racket()}</TableHead>
                  <TableHead>{m.billing_col_member()}</TableHead>
                  <TableHead>{m.request_stringer()}</TableHead>
                  <TableHead className="text-right">
                    {m.request_string_price()}
                  </TableHead>
                  <TableHead className="text-right">
                    {m.request_labour_price()}
                  </TableHead>
                  <TableHead className="text-right">
                    {m.request_total_price()}
                  </TableHead>
                  <TableHead>{m.billing_paid()}</TableHead>
                  {canTogglePaid && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
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
