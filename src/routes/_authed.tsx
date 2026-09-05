import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireApproved } from '#/lib/guards'

/**
 * Pathless layout that gates every member-facing screen on an approved account.
 * UX only — the matching server functions enforce the same rule themselves.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context, location }) => {
    const user = requireApproved(context.user, location.href)
    return { user }
  },
  component: () => <Outlet />,
})
