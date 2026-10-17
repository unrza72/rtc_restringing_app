import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

import { requireRole } from '#/lib/guards'
import { GridWindowPicker, GridWindowProvider } from '#/components/grid-window'
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
    <GridWindowProvider>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl text-foreground">{m.training_title()}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <GridWindowPicker />
            <div className="flex gap-2">
              <SubTab to="/training/people" label={m.training_tab_people()} />
              <SubTab to="/training/plans" label={m.training_tab_plans()} />
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </GridWindowProvider>
  )
}

function SubTab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
        'border-border bg-card text-muted-foreground',
        'hover:bg-sage-100 hover:text-foreground',
      )}
      activeProps={{
        className: 'border-primary bg-primary text-primary-foreground',
      }}
    >
      {label}
    </Link>
  )
}
