import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleHelp,
  Clock,
  GraduationCap,
  HandCoins,
  Layers,
  Receipt,
  Settings,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { getTokenStatus } from '#/server/tokens.functions'
import type { Role } from '#/lib/roles'
import { roleLabel } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { StatusBadge } from '#/components/status-badge'
import { openOnboardingTour } from '#/components/onboarding-tour'

/**
 * Everything the app can do, written for the person reading it: a section or
 * topic only appears when one of their roles can actually use it, and the
 * carabiner topics only when the club has switched carabiners on. Roles are
 * the effective ones from the session, so an admin sees every section.
 */
export const Route = createFileRoute('/_authed/help')({
  loader: async () => ({ tokens: await getTokenStatus() }),
  component: HelpPage,
})

type Topic = {
  id: string
  title: string
  body: string
  /** Shown when the reader has any of these; everyone when left out. */
  roles?: Array<Role>
  /** Only while racket carabiners are switched on. */
  tokensOnly?: boolean
  extra?: React.ReactNode
}

type Section = {
  id: string
  icon: LucideIcon
  title: string
  intro: string
  /** Shown when the reader has any of these; everyone when left out. */
  roles?: Array<Role>
  link?: { to: string; label: string }
  topics: Array<Topic>
}

function sections(): Array<Section> {
  return [
    {
      id: 'request',
      icon: Clock,
      title: m.help_request_title(),
      intro: m.help_request_intro(),
      link: { to: '/requests', label: m.nav_requests() },
      topics: [
        {
          id: 'new',
          title: m.help_request_new_title(),
          body: m.help_request_new_body({ action: m.dash_new_request() }),
        },
        {
          id: 'string',
          title: m.help_request_string_title(),
          body: m.help_request_string_body({ notes: m.request_notes() }),
        },
        {
          id: 'token',
          title: m.help_request_token_title(),
          body: m.help_request_token_body(),
          tokensOnly: true,
        },
        {
          id: 'dropoff',
          title: m.help_request_dropoff_title(),
          body: m.help_request_dropoff_body({ status: m.status_DONE() }),
        },
        {
          id: 'status',
          title: m.help_request_status_title(),
          body: m.help_request_status_body({ page: m.nav_requests() }),
          extra: (
            <span className="flex flex-wrap items-center gap-1.5">
              {(['REQUESTED', 'ACCEPTED', 'DONE', 'COLLECTED'] as const).map(
                (status, i) => (
                  <span key={status} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <ArrowRight className="size-3 text-muted-foreground" />
                    )}
                    <StatusBadge status={status} />
                  </span>
                ),
              )}
            </span>
          ),
        },
        {
          id: 'cancel',
          title: m.help_request_cancel_title(),
          body: m.help_request_cancel_body({ action: m.request_cancel() }),
        },
        {
          id: 'collect',
          title: m.help_request_collect_title(),
          body: m.help_request_collect_body({ action: m.queue_collect() }),
        },
      ],
    },
    {
      id: 'rackets',
      icon: Layers,
      title: m.help_rackets_title(),
      intro: m.help_rackets_intro(),
      link: { to: '/rackets', label: m.nav_rackets() },
      topics: [
        {
          id: 'add',
          title: m.help_rackets_add_title(),
          body: m.help_rackets_add_body({ action: m.racket_add_details() }),
        },
        {
          id: 'edit',
          title: m.help_rackets_edit_title(),
          body: m.help_rackets_edit_body(),
        },
        {
          id: 'archive',
          title: m.help_rackets_archive_title(),
          body: m.help_rackets_archive_body({
            action: m.racket_show_archived(),
          }),
        },
      ],
    },
    {
      id: 'account',
      icon: Settings,
      title: m.help_account_title(),
      intro: m.help_account_intro(),
      topics: [
        {
          id: 'language',
          title: m.help_account_language_title(),
          body: m.help_account_language_body(),
        },
        {
          id: 'tour',
          title: m.help_account_tour_title(),
          body: m.help_account_tour_body({ action: m.onboarding_replay() }),
        },
      ],
    },
    {
      id: 'queue',
      icon: Wrench,
      title: m.help_queue_title(),
      intro: m.help_queue_intro(),
      roles: ['operator'],
      link: { to: '/queue', label: m.nav_queue() },
      topics: [
        {
          id: 'list',
          title: m.help_queue_list_title(),
          body: m.help_queue_list_body({
            mine: m.queue_filter_mine(),
            all: m.queue_filter_all(),
          }),
        },
        {
          id: 'list-token',
          title: m.help_request_token_title(),
          body: m.help_queue_list_token_body(),
          tokensOnly: true,
        },
        {
          id: 'accept',
          title: m.help_queue_accept_title(),
          body: m.help_queue_accept_body({
            accept: m.queue_accept(),
            release: m.queue_release(),
          }),
        },
        {
          id: 'complete',
          title: m.help_queue_complete_title(),
          body: m.help_queue_complete_body({ action: m.queue_complete() }),
        },
        {
          id: 'handover',
          title: m.help_queue_handover_title(),
          body: m.help_queue_handover_body({ action: m.queue_collect() }),
        },
      ],
    },
    {
      id: 'invites',
      icon: UserPlus,
      title: m.help_invites_title(),
      intro: m.help_invites_intro(),
      roles: ['operator'],
      link: { to: '/invites', label: m.nav_invites() },
      topics: [
        {
          id: 'create',
          title: m.help_invites_create_title(),
          body: m.help_invites_create_body({ action: m.invites_create() }),
        },
        {
          id: 'approval',
          title: m.help_invites_approval_title(),
          body: m.help_invites_approval_body(),
        },
        {
          id: 'revoke',
          title: m.help_invites_revoke_title(),
          body: m.help_invites_revoke_body({ action: m.invites_revoke() }),
        },
      ],
    },
    {
      id: 'billing',
      icon: Receipt,
      title: m.help_billing_title(),
      intro: m.help_billing_intro(),
      roles: ['operator', 'controller'],
      link: { to: '/billing', label: m.nav_billing() },
      topics: [
        {
          id: 'overview',
          title: m.help_billing_overview_title(),
          body: m.help_billing_overview_body(),
        },
        {
          id: 'paid',
          title: m.help_billing_paid_title(),
          body: m.help_billing_paid_body({
            paid: m.billing_mark_paid(),
            reset: m.billing_mark_unpaid(),
          }),
          // Stringers see the prices; only controllers settle them.
          roles: ['controller'],
        },
      ],
    },
    {
      id: 'payouts',
      icon: HandCoins,
      title: m.help_payouts_title(),
      intro: m.help_payouts_intro(),
      roles: ['controller'],
      link: { to: '/billing/payouts', label: m.nav_payouts() },
      topics: [
        {
          id: 'balance',
          title: m.help_payouts_balance_title(),
          body: m.help_payouts_balance_body(),
        },
        {
          id: 'reimburse',
          title: m.help_payouts_reimburse_title(),
          body: m.help_payouts_reimburse_body({
            action: m.payouts_reimburse(),
          }),
        },
      ],
    },
    {
      id: 'training',
      icon: GraduationCap,
      title: m.help_training_title(),
      intro: m.help_training_intro(),
      roles: ['coach'],
      link: { to: '/training/people', label: m.nav_training() },
      topics: [
        {
          id: 'roster',
          title: m.help_training_roster_title(),
          body: m.help_training_roster_body(),
        },
        {
          id: 'availability',
          title: m.help_training_availability_title(),
          body: m.help_training_availability_body(),
        },
        {
          id: 'solve',
          title: m.help_training_solve_title(),
          body: m.help_training_solve_body(),
        },
        {
          id: 'results',
          title: m.help_training_results_title(),
          body: m.help_training_results_body(),
        },
      ],
    },
    {
      id: 'admin',
      icon: Users,
      title: m.help_admin_title(),
      intro: m.help_admin_intro(),
      roles: ['admin'],
      link: { to: '/admin/members', label: m.nav_admin_members() },
      topics: [
        {
          id: 'approve',
          title: m.help_admin_approve_title(),
          body: m.help_admin_approve_body({
            approve: m.admin_approve(),
            reject: m.admin_reject(),
          }),
        },
        {
          id: 'roles',
          title: m.help_admin_roles_title(),
          body: m.help_admin_roles_body({
            operator: roleLabel('operator'),
            controller: roleLabel('controller'),
            coach: roleLabel('coach'),
            admin: roleLabel('admin'),
          }),
        },
        {
          id: 'strings',
          title: m.help_admin_strings_title(),
          body: m.help_admin_strings_body(),
        },
        {
          id: 'tokens',
          title: m.help_admin_tokens_title(),
          body: m.help_admin_tokens_body(),
          tokensOnly: true,
        },
      ],
    },
  ]
}

function HelpPage() {
  const { user } = Route.useRouteContext()
  const { tokens } = Route.useLoaderData()

  const allowed = (roles?: Array<Role>) =>
    !roles || roles.some((role) => user.roles.includes(role))
  const visible = sections()
    .filter((section) => allowed(section.roles))
    .map((section) => ({
      ...section,
      topics: section.topics.filter(
        (topic) =>
          allowed(topic.roles) && (!topic.tokensOnly || tokens.enabled),
      ),
    }))

  // Everyone is a member; listing it next to the specialties adds nothing.
  const specialties = user.roles.filter((role) => role !== 'member')

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-3xl text-foreground">{m.help_title()}</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {m.help_intro()}
            {(['member', ...specialties] as Array<Role>).map((role) => (
              <span
                key={role}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {roleLabel(role)}
              </span>
            ))}
          </p>
        </div>
        <Button variant="outline" onClick={openOnboardingTour}>
          <CircleHelp />
          {m.help_start_tour()}
        </Button>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[13rem_1fr]">
        <nav
          aria-label={m.help_contents()}
          className="grid gap-2 lg:sticky lg:top-36"
        >
          <span className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {m.help_contents()}
          </span>
          <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
            {visible.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sand hover:text-foreground lg:rounded-lg lg:border-0"
                >
                  <section.icon className="size-3.5" />
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-6">
          {visible.map((section) => (
            <HelpSection
              key={section.id}
              section={section}
              audience={
                section.roles
                  ? m.help_for({ roles: audienceLabel(section.roles) })
                  : null
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** "Besaiter" or "Besaiter oder Kassier" — who a section is written for. */
function audienceLabel(roles: Array<Role>) {
  const labels = roles.map(roleLabel)
  return labels.length === 2
    ? m.help_or({ a: labels[0], b: labels[1] })
    : labels.join(', ')
}

function HelpSection({
  section,
  audience,
}: {
  section: Section
  audience: string | null
}) {
  return (
    <Card id={section.id} className="scroll-mt-24 rounded-2xl lg:scroll-mt-36">
      <CardHeader className="gap-2">
        {audience && (
          <span className="text-xs font-medium tracking-[0.16em] text-primary-ink uppercase">
            {audience}
          </span>
        )}
        <h2 className="flex items-start gap-2.5 text-2xl text-foreground">
          <section.icon className="mt-1 size-5 shrink-0 text-primary-ink" />
          {section.title}
        </h2>
        <p className="text-sm text-muted-foreground">{section.intro}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid gap-5">
          {section.topics.map((topic) => (
            <div key={topic.id} className="grid gap-1.5">
              <dt className="text-sm font-semibold text-foreground">
                {topic.title}
              </dt>
              <dd className="grid gap-2.5 text-sm leading-relaxed text-foreground/85">
                {topic.body}
                {topic.extra}
              </dd>
            </div>
          ))}
        </dl>
        {section.link && (
          <Link
            to={section.link.to}
            className="flex items-center gap-1.5 justify-self-start text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
          >
            {m.help_open_page({ page: section.link.label })}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
