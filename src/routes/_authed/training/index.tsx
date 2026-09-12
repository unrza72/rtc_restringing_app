import { createFileRoute, redirect } from '@tanstack/react-router'

/** The roster is where planning starts, so /training lands there. */
export const Route = createFileRoute('/_authed/training/')({
  beforeLoad: () => {
    throw redirect({ to: '/training/people' })
  },
})
