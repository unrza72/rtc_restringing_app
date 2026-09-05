import { createFileRoute, redirect } from '@tanstack/react-router'
import { Hourglass, ShieldX } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth-shell'

/** Where signed-in but unapproved members land. The only app screen they get. */
export const Route = createFileRoute('/pending')({
  beforeLoad: ({ context }) => {
    if (!context.user)
      throw redirect({ to: '/login', search: { redirect: undefined } })
    if (context.user.status === 'APPROVED') throw redirect({ to: '/dashboard' })
  },
  component: PendingPage,
})

function PendingPage() {
  const { user } = Route.useRouteContext()
  const rejected = user?.status === 'REJECTED'
  const Icon = rejected ? ShieldX : Hourglass

  return (
    <AuthShell
      title={rejected ? m.pending_rejected_title() : m.pending_title()}
      subtitle={m.pending_signed_in_as({ email: user?.email ?? '' })}
    >
      <div className="grid gap-4 p-6">
        <span
          className={
            'flex size-11 items-center justify-center rounded-xl border ' +
            (rejected
              ? 'border-rose-800 bg-rose-950 text-rose-300'
              : 'border-amber-600 bg-amber-950 text-amber-300')
          }
        >
          <Icon className="size-5" />
        </span>
        <p className="text-sm leading-relaxed text-slate-400">
          {rejected ? m.pending_rejected_body() : m.pending_body()}
        </p>
      </div>
    </AuthShell>
  )
}
