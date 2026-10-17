import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Archive,
  ArrowRight,
  History,
  Layers,
  PencilLine,
  Plus,
  Spool,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { completeOnboarding } from '#/server/onboarding.functions'
import { getTokenStatus } from '#/server/tokens.functions'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { StatusBadge } from '#/components/status-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

/**
 * The welcome tour: a short walk through requesting a restring, opened on its
 * own the first time an approved member reaches the app and replayable from
 * the dashboard and the header menu. Managing rackets is offered as an optional last chapter — a
 * request works without one, so nobody has to learn it before their first.
 *
 * Closing the tour any way at all — finishing, skipping, the ✕, Escape —
 * records it as seen, so it never comes back uninvited.
 */

type StepId = 'welcome' | 'request' | 'handover' | 'rackets-offer' | 'rackets'

/** The main path; 'rackets' is the optional detour after it. */
const MAIN_STEPS: Array<StepId> = [
  'welcome',
  'request',
  'handover',
  'rackets-offer',
]

// A plain listener set rather than a React context: the header sits in the
// root shell, outside the `_authed` layout that hosts the tour, yet needs to
// open it too. Holds no state, so sharing it across server requests is
// harmless — it is only ever called from click handlers.
const openListeners = new Set<() => void>()

/**
 * Opens the tour again — the dashboard's "how it works" button and the header
 * menu's. A no-op where no tour is mounted (signed out, awaiting approval).
 */
export function openOnboardingTour() {
  for (const listener of openListeners) listener()
}

export function OnboardingProvider({
  onboarded,
  children,
}: {
  /** From the session: has this member seen the tour before? */
  onboarded: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!onboarded)
  const router = useRouter()
  const complete = useServerFn(completeOnboarding)
  // Guards against a second write when the tour is closed twice before the
  // refreshed session (onboarded: true) has arrived.
  const recorded = useRef(onboarded)

  useEffect(() => {
    const listener = () => setOpen(true)
    openListeners.add(listener)
    return () => {
      openListeners.delete(listener)
    }
  }, [])

  function close() {
    setOpen(false)
    if (recorded.current) return
    recorded.current = true
    void complete().then(() => router.invalidate())
  }

  return (
    <>
      {children}
      <OnboardingTour open={open} onClose={close} />
    </>
  )
}

function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState<StepId>('welcome')
  const tokensEnabled = useTokensEnabled(open)

  // Every opening starts from the top, including a replay.
  useEffect(() => {
    if (open) setStep('welcome')
  }, [open])

  const mainIndex = MAIN_STEPS.indexOf(step)
  const next = () => setStep(MAIN_STEPS[mainIndex + 1])
  const back = () =>
    setStep(step === 'rackets' ? 'rackets-offer' : MAIN_STEPS[mainIndex - 1])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="gap-5 rounded-2xl sm:max-w-xl"
        // A stray click beside the dialog shouldn't end the tour for good —
        // only its own buttons, the ✕ and Escape do.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <Progress step={step} />

        {step === 'welcome' && (
          <StepBody
            title={m.onboarding_welcome_title()}
            description={m.onboarding_welcome_body()}
          >
            <ul className="grid gap-2 text-sm">
              <Point icon={Spool}>{m.onboarding_welcome_point_request()}</Point>
              <Point icon={Layers}>
                {m.onboarding_welcome_point_rackets()}
              </Point>
            </ul>
          </StepBody>
        )}

        {step === 'request' && (
          <StepBody
            title={m.onboarding_request_title()}
            description={m.onboarding_request_body()}
          >
            <ol className="grid gap-3 text-sm">
              <NumberedPoint n={1}>
                {m.onboarding_request_step_open({
                  action: m.dash_new_request(),
                })}
              </NumberedPoint>
              <NumberedPoint n={2}>
                {m.onboarding_request_step_racket()}
              </NumberedPoint>
              <NumberedPoint n={3}>
                {m.onboarding_request_step_string()}
              </NumberedPoint>
              {tokensEnabled && (
                <NumberedPoint n={4}>
                  {m.onboarding_request_step_token()}
                </NumberedPoint>
              )}
              <NumberedPoint n={tokensEnabled ? 5 : 4}>
                {m.onboarding_request_step_submit({
                  action: m.request_submit(),
                })}
              </NumberedPoint>
            </ol>
          </StepBody>
        )}

        {step === 'handover' && (
          <StepBody
            title={m.onboarding_handover_title()}
            description={
              tokensEnabled
                ? m.onboarding_handover_body_token()
                : m.onboarding_handover_body()
            }
          >
            <ul className="grid gap-3 text-sm">
              <StatusPoint status="REQUESTED">
                {m.onboarding_status_requested()}
              </StatusPoint>
              <StatusPoint status="ACCEPTED">
                {m.onboarding_status_accepted()}
              </StatusPoint>
              <StatusPoint status="DONE">
                {m.onboarding_status_done()}
              </StatusPoint>
              <StatusPoint status="COLLECTED">
                {m.onboarding_status_collected()}
              </StatusPoint>
            </ul>
            <p className="text-sm text-muted-foreground">
              {m.onboarding_handover_track({ page: m.nav_requests() })}
            </p>
          </StepBody>
        )}

        {step === 'rackets-offer' && (
          <StepBody
            title={m.onboarding_offer_title()}
            description={m.onboarding_offer_body()}
          />
        )}

        {step === 'rackets' && (
          <StepBody
            title={m.onboarding_rackets_title()}
            description={m.onboarding_rackets_body({ page: m.nav_rackets() })}
          >
            <ul className="grid gap-3 text-sm">
              <Point icon={Plus}>{m.onboarding_rackets_point_add()}</Point>
              <Point icon={PencilLine}>
                {m.onboarding_rackets_point_details()}
              </Point>
              <Point icon={History}>
                {m.onboarding_rackets_point_history()}
              </Point>
              <Point icon={Archive}>
                {m.onboarding_rackets_point_archive()}
              </Point>
            </ul>
          </StepBody>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          {step === 'welcome' ? (
            <Button variant="ghost" onClick={onClose}>
              {m.onboarding_skip()}
            </Button>
          ) : (
            <Button variant="ghost" onClick={back}>
              {m.common_back()}
            </Button>
          )}

          {step === 'rackets-offer' ? (
            <span className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={onClose}>
                {m.onboarding_offer_decline()}
              </Button>
              <Button onClick={() => setStep('rackets')}>
                {m.onboarding_offer_accept()}
              </Button>
            </span>
          ) : step === 'rackets' ? (
            <span className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={onClose}>
                {m.onboarding_finish()}
              </Button>
              <Button asChild>
                <Link to="/rackets/new" onClick={onClose}>
                  {m.racket_add()}
                </Link>
              </Button>
            </span>
          ) : (
            <Button onClick={next}>
              {step === 'welcome' ? m.onboarding_start() : m.onboarding_next()}
              <ArrowRight />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Whether the club uses numbered carabiners — it decides whether the tour
 * mentions them. Asked once, the first time the tour opens; until the answer
 * arrives the steps read as if there were none.
 */
function useTokensEnabled(open: boolean) {
  const fetchStatus = useServerFn(getTokenStatus)
  const [enabled, setEnabled] = useState(false)
  const asked = useRef(false)

  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    fetchStatus()
      .then((status) => setEnabled(status.enabled))
      .catch(() => {})
  }, [open, fetchStatus])

  return enabled
}

function Progress({ step }: { step: StepId }) {
  if (step === 'rackets') {
    return (
      <span className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {m.onboarding_optional()}
      </span>
    )
  }
  const index = MAIN_STEPS.indexOf(step)
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={m.onboarding_progress({
        step: index + 1,
        total: MAIN_STEPS.length,
      })}
    >
      {MAIN_STEPS.map((id, i) => (
        <span
          key={id}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === index ? 'w-6 bg-primary' : 'w-1.5',
            i < index && 'bg-primary/40',
            i > index && 'bg-border',
          )}
        />
      ))}
    </div>
  )
}

function StepBody({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="grid gap-4">
      <DialogHeader className="text-left">
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          {description}
        </DialogDescription>
      </DialogHeader>
      {children}
    </div>
  )
}

function Point({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary-ink">
        <Icon className="size-3.5" />
      </span>
      <span className="pt-1">{children}</span>
    </li>
  )
}

function NumberedPoint({
  n,
  children,
}: {
  n: number
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  )
}

function StatusPoint({
  status,
  children,
}: {
  status: string
  children: React.ReactNode
}) {
  return (
    <li className="grid items-start gap-1.5 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
      <span>
        <StatusBadge status={status} />
      </span>
      <span>{children}</span>
    </li>
  )
}
