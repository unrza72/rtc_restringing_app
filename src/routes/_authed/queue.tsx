import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireRole } from '#/lib/guards'

/** Everything under /queue is operators only. */
export const Route = createFileRoute('/_authed/queue')({
  beforeLoad: ({ context, location }) => {
    requireRole(context.user, 'operator', location.href)
  },
  component: () => <Outlet />,
})
