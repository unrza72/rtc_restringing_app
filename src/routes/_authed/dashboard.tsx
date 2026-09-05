import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Plus } from 'lucide-react'

import { listMyRequests } from '#/server/requests.functions'
import { isOpen } from '#/lib/status'
import { m } from '#/paraglide/messages'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'
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
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {m.dash_title({ name: user.name })}
        </h1>
        <Link
          to="/requests/new"
          className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-lime-400/10 transition-all hover:bg-lime-300 active:scale-95"
        >
          <Plus className="size-3.5 stroke-[3]" />
          {m.dash_new_request()}
        </Link>
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
              accent="amber"
            />
          )}
          {user.roles.includes('admin') && (
            <ShortcutCard
              title={m.dash_admin_panel()}
              action={m.dash_review_members()}
              to="/admin/members"
              accent="emerald"
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
  accent,
}: {
  title: string
  action: string
  to: string
  accent: 'amber' | 'emerald'
}) {
  const tone =
    accent === 'amber'
      ? 'hover:border-amber-600/60 text-amber-300'
      : 'hover:border-emerald-500/60 text-emerald-300'

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 transition-colors',
        tone,
      )}
    >
      <span>
        <span className="block text-[10px] font-bold tracking-wider uppercase">
          {title}
        </span>
        <span className="mt-1 block text-sm font-semibold text-white">
          {action}
        </span>
      </span>
      <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
