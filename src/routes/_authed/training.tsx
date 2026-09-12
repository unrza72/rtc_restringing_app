import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

import { requireRole } from '#/lib/guards'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

/** Everything under /training is coaches only; admins inherit the role. */
export const Route = createFileRoute('/_authed/training')({
  beforeLoad: ({ context, location }) => {
    requireRole(context.user, 'coach', location.href)
  },
  component: TrainingLayout,
})

function TrainingLayout() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {m.training_title()}
        </h1>
        <div className="flex gap-2">
          <SubTab to="/training/people" label={m.training_tab_people()} />
          <SubTab to="/training/plans" label={m.training_tab_plans()} />
        </div>
      </div>
      <Outlet />
    </div>
  )
}

function SubTab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
        'border-slate-800 bg-slate-900 text-slate-400',
        'hover:bg-slate-800 hover:text-slate-200',
      )}
      activeProps={{
        className: 'border-lime-500 bg-lime-500 text-slate-950 shadow-md',
      }}
    >
      {label}
    </Link>
  )
}
