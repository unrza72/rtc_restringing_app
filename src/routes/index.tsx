import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { ClubLogo } from '#/components/club-logo'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({
        to: context.user.status === 'APPROVED' ? '/dashboard' : '/pending',
      })
    }
  },
  component: Landing,
})

function Landing() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <ClubLogo stacked className="mx-auto" />
      <p className="mt-6 text-sm text-muted-foreground">{m.app_tagline()}</p>

      {/* No "create account" here — signup only exists behind an invite link
          a member/admin sent directly, so there's nothing to discover. */}
      <div className="mt-8 flex justify-center">
        <Link
          to="/login"
          search={{ redirect: undefined }}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {m.auth_sign_in_action()}
        </Link>
      </div>
    </div>
  )
}
