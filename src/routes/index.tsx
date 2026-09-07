import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'

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
      <span className="ball-tile mx-auto flex size-16 items-center justify-center rounded-2xl text-4xl">
        🎾
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
        {m.app_name()}
      </h1>
      <span className="mt-2 inline-block rounded border border-lime-400/30 bg-lime-400/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-lime-300 uppercase">
        {m.app_badge()}
      </span>
      <p className="mt-3 text-sm text-slate-400">{m.app_tagline()}</p>

      {/* No "create account" here — signup only exists behind an invite link
          a member/admin sent directly, so there's nothing to discover. */}
      <div className="mt-8 flex justify-center">
        <Link
          to="/login"
          search={{ redirect: undefined }}
          className="rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-lime-400/10 transition-all hover:bg-lime-300 active:scale-95"
        >
          {m.auth_sign_in_action()}
        </Link>
      </div>
    </div>
  )
}
