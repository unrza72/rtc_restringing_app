import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  deleteTrainingPlan,
  getTrainingPlan,
} from '#/server/training.functions'
import {
  BALL_BADGE,
  WEEKDAYS,
  formatSlot,
  normaliseWindow,
} from '#/lib/training'
import { useGridWindow } from '#/components/grid-window'
import { ScheduleTimetable } from '#/components/schedule-timetable'
import type { Ball } from '#/lib/training'
import type { UnplacedReason } from '#/solver/types'
import { formatDate } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { FormError } from '#/components/form-field'

export const Route = createFileRoute('/_authed/training/plans/$id')({
  loader: async ({ params }) => ({
    plan: await getTrainingPlan({ data: { id: params.id } }),
  }),
  component: PlanPage,
})

function PlanPage() {
  const { plan } = Route.useLoaderData()
  const router = useRouter()
  const remove = useServerFn(deleteTrainingPlan)
  const { gridWindow } = useGridWindow()
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    try {
      await remove({ data: { id: plan.id } })
      await router.navigate({ to: '/training/plans' })
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  const days = WEEKDAYS.map((day) => ({
    day,
    groups: plan.groups.filter((g) => g.weekday === day),
  })).filter((d) => d.groups.length > 0)

  // The timetable only draws the configured hours; the per-day list below is
  // always complete, so this just explains the discrepancy.
  const { startMin, endMin } = normaliseWindow(gridWindow)
  const hidden = plan.groups.filter(
    (g) => g.endMin <= startMin || g.startMin >= endMin,
  ).length

  return (
    <div className="grid gap-6">
      <Link
        to="/training/plans"
        className="text-sm text-slate-400 underline-offset-4 hover:underline"
      >
        ← {m.common_back()}
      </Link>

      <FormError>{error}</FormError>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            {plan.name}
            <span className="text-xs font-normal text-slate-500">
              {formatDate(plan.createdAt)} ·{' '}
              {m.training_plan_by({ name: plan.createdBy.name })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => void handleDelete()}
            >
              {m.training_plan_delete()}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* The knobs are copied onto the plan, so an old run still explains
              itself after the defaults have moved on. */}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Knob
              label={m.training_plan_min_group()}
              value={plan.minGroupSize}
            />
            <Knob
              label={m.training_plan_max_group()}
              value={plan.maxGroupSize}
            />
            <Knob
              label={m.training_plan_spread()}
              value={plan.strengthSpread}
            />
            <Knob label={m.training_plan_courts()} value={plan.courtCount} />
            <Knob
              label={m.training_plan_session()}
              value={plan.sessionMinutes}
            />
            <Knob label={m.training_plan_step()} value={plan.slotStepMinutes} />
          </dl>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold tracking-tight text-white">
          {m.training_groups_title()}{' '}
          <span className="text-sm font-normal text-slate-500">
            {m.training_plan_group_count({ count: plan.groups.length })}
          </span>
        </h2>

        {plan.groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {m.training_groups_empty()}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="grid gap-3 py-4">
                {hidden > 0 && (
                  <p className="rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                    {m.training_schedule_outside({ count: hidden })}
                  </p>
                )}
                <ScheduleTimetable
                  groups={plan.groups}
                  gridWindow={gridWindow}
                />
              </CardContent>
            </Card>

            {days.map(({ day, groups }) => (
              <Card key={day}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {m[`training_weekday_${day}`]()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <ul className="divide-y">
                    {groups.map((group) => (
                      <li key={group.id} className="grid gap-1.5 py-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm text-slate-200">
                            {formatSlot(group.startMin, group.endMin)}
                          </span>
                          <Badge
                            variant="outline"
                            className={BALL_BADGE[group.ball as Ball]}
                          >
                            {m[`training_ball_${group.ball as Ball}`]()}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {m.training_group_court({ court: group.court })}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
                            {m.training_group_trainer()}:{' '}
                            <span className="text-slate-200">
                              {group.trainer.name}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.members.map(({ person }) => (
                            <span
                              key={person.id}
                              className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
                            >
                              {person.name}
                              {person.strength !== null && (
                                <span className="ml-1.5 text-slate-500">
                                  {person.strength}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold tracking-tight text-white">
          {m.training_unplaced_title()}{' '}
          <span className="text-sm font-normal text-slate-500">
            {m.training_plan_unplaced_count({ count: plan.unplaced.length })}
          </span>
        </h2>
        <Card>
          <CardContent className="py-2">
            {plan.unplaced.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {m.training_unplaced_empty()}
              </p>
            ) : (
              <ul className="divide-y">
                {plan.unplaced.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <span className="text-sm text-slate-200">
                      {entry.person.name}
                    </span>
                    {entry.person.ball && (
                      <Badge
                        variant="outline"
                        className={BALL_BADGE[entry.person.ball as Ball]}
                      >
                        {m[`training_ball_${entry.person.ball as Ball}`]()}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-amber-400">
                      {m[`training_reason_${entry.reason as UnplacedReason}`]()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Knob({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-slate-200">{value}</dd>
    </div>
  )
}
