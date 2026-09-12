import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  listTrainingPlans,
  solveAndSavePlan,
} from '#/server/training.functions'
import { solvePlanSchema } from '#/lib/schemas'
import { formatDate } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FormError } from '#/components/form-field'

export const Route = createFileRoute('/_authed/training/plans/')({
  loader: async () => ({ plans: await listTrainingPlans() }),
  component: PlansPage,
})

function PlansPage() {
  const { plans } = Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="grid gap-6">
      <SolveCard
        onSolved={(id) =>
          router.navigate({ to: '/training/plans/$id', params: { id } })
        }
      />

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.training_plans_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-2">
            <ul className="divide-y">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <Link
                    to="/training/plans/$id"
                    params={{ id: plan.id }}
                    className="font-medium text-slate-200 underline-offset-4 hover:underline"
                  >
                    {plan.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {formatDate(plan.createdAt)} ·{' '}
                    {m.training_plan_by({ name: plan.createdBy.name })}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-xs">
                    <span className="text-slate-300">
                      {m.training_plan_group_count({
                        count: plan._count.groups,
                      })}
                    </span>
                    <span
                      className={
                        plan._count.unplaced > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }
                    >
                      {m.training_plan_unplaced_count({
                        count: plan._count.unplaced,
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** The solver knobs. Plain state — the schema does the validating on submit. */
const DEFAULT_KNOBS = {
  name: '',
  minGroupSize: '2',
  maxGroupSize: '4',
  strengthSpread: '1',
  sessionMinutes: '60',
  slotStepMinutes: '30',
  courtCount: '4',
}

function SolveCard({ onSolved }: { onSolved: (id: string) => void }) {
  const solve = useServerFn(solveAndSavePlan)
  const [knobs, setKnobs] = useState(DEFAULT_KNOBS)
  const [error, setError] = useState<string | null>(null)
  const [solving, setSolving] = useState(false)

  const set = (key: keyof typeof DEFAULT_KNOBS) => (value: string) =>
    setKnobs((k) => ({ ...k, [key]: value }))

  async function handleSubmit() {
    setError(null)
    setSolving(true)
    try {
      const plan = await solve({ data: solvePlanSchema.parse(knobs) })
      onSolved(plan.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    } finally {
      setSolving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.training_plan_knobs()}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <FormError>{error}</FormError>

          <Field id="plan-name" label={m.training_plan_name()}>
            <Input
              id="plan-name"
              placeholder="Winter 2026"
              value={knobs.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <NumberField
              id="minGroupSize"
              label={m.training_plan_min_group()}
              min={1}
              value={knobs.minGroupSize}
              onChange={set('minGroupSize')}
            />
            <NumberField
              id="maxGroupSize"
              label={m.training_plan_max_group()}
              min={1}
              value={knobs.maxGroupSize}
              onChange={set('maxGroupSize')}
            />
            <NumberField
              id="strengthSpread"
              label={m.training_plan_spread()}
              min={0}
              step="0.5"
              value={knobs.strengthSpread}
              onChange={set('strengthSpread')}
            />
            <NumberField
              id="courtCount"
              label={m.training_plan_courts()}
              min={1}
              value={knobs.courtCount}
              onChange={set('courtCount')}
            />
            <NumberField
              id="sessionMinutes"
              label={m.training_plan_session()}
              min={15}
              step="5"
              value={knobs.sessionMinutes}
              onChange={set('sessionMinutes')}
            />
            <NumberField
              id="slotStepMinutes"
              label={m.training_plan_step()}
              min={5}
              step="5"
              value={knobs.slotStepMinutes}
              onChange={set('slotStepMinutes')}
            />
          </div>

          <Button
            type="submit"
            disabled={solving}
            className="justify-self-start font-bold"
          >
            {solving ? m.training_plan_solving() : m.training_plan_solve()}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function NumberField({
  id,
  label,
  min,
  step,
  value,
  onChange,
}: {
  id: string
  label: string
  min: number
  step?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        type="number"
        min={min}
        step={step ?? '1'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}
