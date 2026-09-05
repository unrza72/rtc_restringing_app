import { createFileRoute, redirect } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

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

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>
            {rejected ? m.pending_rejected_title() : m.pending_title()}
          </CardTitle>
          <CardDescription>
            {m.pending_signed_in_as({
              username: user?.displayUsername ?? user?.username ?? '',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {rejected ? m.pending_rejected_body() : m.pending_body()}
        </CardContent>
      </Card>
    </div>
  )
}
