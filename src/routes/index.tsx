import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'

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
      <h1 className="text-3xl font-semibold tracking-tight">{m.app_name()}</h1>
      <p className="mt-3 text-muted-foreground">{m.app_tagline()}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild>
          <Link to="/login" search={{ redirect: undefined }}>
            {m.auth_sign_in_action()}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/signup">{m.auth_sign_up_action()}</Link>
        </Button>
      </div>
    </div>
  )
}
