import { Link, useMatches } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import { m } from '#/paraglide/messages'

/**
 * One entry per route that should contribute a crumb, keyed by route id.
 * `null` means "this route exists but has nothing worth naming" — a pathless
 * layout, or a redirect-only index — so its match is skipped rather than
 * producing an empty or duplicate label. A route not listed here at all is
 * skipped the same way, which is what keeps `/`, `/login` etc. crumb-free.
 *
 * The link target is never hand-typed: the renderer below uses the match's
 * own `pathname`, so a resolver only has to supply text.
 */
const LABELS: Partial<Record<string, (loaderData: unknown) => string | null>> =
  {
    '/_authed/dashboard': () => null,

    '/_authed/rackets/': () => m.nav_rackets(),
    '/_authed/rackets/new': () => m.racket_new_title(),
    '/_authed/rackets/$id': (loaderData) => {
      const data = loaderData as { racket: { label: string } } | undefined
      return data?.racket.label ?? null
    },

    '/_authed/requests/': () => m.nav_requests(),
    '/_authed/requests/new': () => m.request_new_title(),
    '/_authed/requests/$id': (loaderData) => {
      const data = loaderData as
        { request: { racket: { label: string } } } | undefined
      return data?.request.racket.label ?? null
    },

    '/_authed/queue': () => null,
    '/_authed/queue/': () => m.nav_queue(),
    '/_authed/queue/$id': (loaderData) => {
      const data = loaderData as
        { request: { racket: { label: string } } } | undefined
      return data?.request.racket.label ?? null
    },

    '/_authed/billing': () => null,
    '/_authed/billing/': () => m.nav_billing(),
    '/_authed/billing/payouts': () => m.nav_payouts(),

    '/_authed/invites': () => m.nav_invites(),

    // The section landing page redirects straight to /training/people, so this
    // crumb is what a user actually sees for "training" as a concept.
    '/_authed/training': () => m.nav_training(),
    '/_authed/training/': () => null,
    '/_authed/training/people/': () => m.training_tab_people(),
    '/_authed/training/people/$id': (loaderData) => {
      const data = loaderData as { person: { name: string } } | undefined
      return data?.person.name ?? null
    },
    '/_authed/training/plans/': () => m.training_tab_plans(),
    '/_authed/training/plans/$id': (loaderData) => {
      const data = loaderData as { plan: { name: string } } | undefined
      return data?.plan.name ?? null
    },

    '/_authed/admin': () => null,
    '/_authed/admin/members': () => m.nav_admin_members(),
    '/_authed/admin/strings': () => m.nav_admin_strings(),
  }

type Crumb = { label: string; to: string }

/**
 * Sits under the header on every authed page. Absent on the public shell
 * (`/`, `/login`, `/signup`, `/pending`) and on the dashboard itself — a
 * one-item trail ("Home") points nowhere useful, so it renders nothing rather
 * than a lone, unclickable label.
 */
export function Breadcrumbs() {
  const matches = useMatches()
  if (!matches.some((match) => match.routeId === '/_authed')) return null

  const crumbs: Array<Crumb> = [{ label: m.nav_dashboard(), to: '/dashboard' }]
  for (const match of matches) {
    const resolve = LABELS[match.routeId]
    const label = resolve?.(match.loaderData)
    if (label) crumbs.push({ label, to: match.pathname })
  }

  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label={m.breadcrumb_nav_label()}
      className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <Fragment key={crumb.to}>
            {i > 0 && (
              <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
            )}
            {isLast ? (
              <span
                aria-current="page"
                className="max-w-[16rem] truncate font-medium text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="max-w-[12rem] truncate underline-offset-4 hover:text-foreground hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
