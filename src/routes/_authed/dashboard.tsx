import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { listMyRequests } from '#/server/requests.functions'
import { isOpen } from '#/lib/status'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { RequestList } from '#/components/request-list'

export const Route = createFileRoute('/_authed/dashboard')({
  loader: async () => ({ requests: await listMyRequests() }),
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { requests } = Route.useLoaderData()
  const open = requests.filter((r) => isOpen(r.status))

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {m.dash_title({ name: user.name })}
        </h1>
        <Button asChild>
          <Link to="/requests/new">{m.dash_new_request()}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.dash_open_requests()}</CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.dash_no_open_requests()}
            </p>
          ) : (
            <RequestList requests={open} />
          )}
        </CardContent>
      </Card>

      {(user.roles.includes('operator') || user.roles.includes('admin')) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {user.roles.includes('operator') && (
            <ShortcutCard
              title={m.dash_operator_panel()}
              action={m.dash_open_queue()}
              to="/queue"
            />
          )}
          {user.roles.includes('admin') && (
            <ShortcutCard
              title={m.dash_admin_panel()}
              action={m.dash_review_members()}
              to="/admin/members"
            />
          )}
        </div>
      )}
    </div>
  )
}

function ShortcutCard({
  title,
  action,
  to,
}: {
  title: string
  action: string
  to: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link to={to}>
            {action}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
