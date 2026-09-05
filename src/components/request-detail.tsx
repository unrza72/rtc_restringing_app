import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { StatusBadge } from '#/components/status-badge'
import {
  describeString,
  formatDate,
  formatDateTime,
  formatPrice,
  formatTension,
} from '#/lib/labels'
import { m } from '#/paraglide/messages'

type Person = { id: string; name: string; displayUsername?: string | null }

export type RequestDetailData = {
  id: string
  status: string
  stringSource: string
  ownStringName: string | null
  tensionMain: number
  tensionCross: number | null
  neededBy: Date | string | null
  memberNotes: string | null
  createdAt: Date | string
  usedStringName: string | null
  usedTensionMain: number | null
  usedTensionCross: number | null
  priceCents: number | null
  operatorNotes: string | null
  racket: {
    label: string
    brand: string | null
    model: string | null
    stringPattern: string | null
  }
  clubString: { name: string; gauge: string | null } | null
  requester: Person
  operator: Person | null
}

export function RequestSummary({
  request,
  showRequester = false,
}: {
  request: RequestDetailData
  showRequester?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{request.racket.label}</CardTitle>
        <StatusBadge status={request.status} />
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label={m.request_racket()}>
            {[request.racket.brand, request.racket.model]
              .filter(Boolean)
              .join(' ') || m.common_none()}
            {request.racket.stringPattern &&
              ` · ${request.racket.stringPattern}`}
          </Row>

          {showRequester && (
            <Row label={m.request_label_requester()}>
              {request.requester.name}
            </Row>
          )}

          <Row label={m.request_string_source()}>
            {describeString(request)}
            <span className="text-muted-foreground">
              {' '}
              (
              {request.stringSource === 'CLUB'
                ? m.request_source_club()
                : m.request_source_member()}
              )
            </span>
          </Row>

          <Row label={m.request_tension_main()}>
            {formatTension(request.tensionMain, request.tensionCross)}
          </Row>

          <Row label={m.request_label_created()}>
            {formatDate(request.createdAt)}
          </Row>

          {request.neededBy && (
            <Row label={m.request_needed_by()}>
              {formatDate(request.neededBy)}
            </Row>
          )}

          <Row label={m.request_stringer()}>
            {request.operator?.name ?? m.request_unassigned()}
          </Row>

          {request.memberNotes && (
            <Row label={m.request_notes()} full>
              {request.memberNotes}
            </Row>
          )}

          {request.usedStringName && (
            <>
              <Row label={m.request_used_string()}>
                {request.usedStringName}
                {request.usedTensionMain != null &&
                  ` · ${formatTension(request.usedTensionMain, request.usedTensionCross)}`}
              </Row>
              <Row label={m.request_price()}>
                {formatPrice(request.priceCents)}
              </Row>
            </>
          )}

          {request.operatorNotes && (
            <Row label={m.request_operator_notes()} full>
              {request.operatorNotes}
            </Row>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-200">{children}</dd>
    </div>
  )
}

export function RequestTimeline({
  events,
}: {
  events: Array<{
    id: string
    toStatus: string
    note: string | null
    createdAt: Date | string
    actor: { name: string }
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.request_timeline()}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <StatusBadge status={event.toStatus} />
              <span className="text-sm font-semibold text-white">
                {event.actor.name}
              </span>
              <span className="text-xs text-slate-500">
                {formatDateTime(event.createdAt)}
              </span>
              {event.note && (
                <span className="w-full text-sm text-muted-foreground">
                  {event.note}
                </span>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
