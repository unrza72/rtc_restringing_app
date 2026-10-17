import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireApproved } from '#/lib/guards'
import { OnboardingProvider } from '#/components/onboarding-tour'

/**
 * Pathless layout that gates every member-facing screen on an approved account.
 * UX only — the matching server functions enforce the same rule themselves.
 *
 * Also hosts the welcome tour, so it opens on whichever page a new member
 * lands on first — not only the dashboard, since a login can redirect anywhere.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context, location }) => {
    const user = requireApproved(context.user, location.href)
    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  return (
    <OnboardingProvider onboarded={user.onboarded}>
      <Outlet />
    </OnboardingProvider>
  )
}
