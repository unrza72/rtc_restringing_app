import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireRole } from '#/lib/guards'

/** Everything under /admin is admins only. */
export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context, location }) => {
    requireRole(context.user, 'admin', location.href)
  },
  component: () => <Outlet />,
})
