import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireAnyRole } from '#/lib/guards'

/**
 * Stringers, controllers and admins — the last two via the role cascade.
 * The narrower "/billing/payouts" adds its own, stricter guard on top.
 */
export const Route = createFileRoute('/_authed/billing')({
  beforeLoad: ({ context, location }) => {
    requireAnyRole(context.user, ['operator', 'controller'], location.href)
  },
  component: () => <Outlet />,
})
