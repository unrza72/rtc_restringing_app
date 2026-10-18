import { Link } from '@tanstack/react-router'

import { StatusBadge } from '#/components/status-badge'
import { describeString, formatDate, formatTension } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

export type RequestRow = {
  id: string
  status: string
  stringSource: string
  ownStringName: string | null
  tensionMain: number | null
  tensionCross: number | null
  neededBy: Date | string | null
  tokenNumber?: number | null
  createdAt: Date | string
  racket: { label: string }
  clubString: { name: string; gauge: string | null } | null
  requester?: { name: string } | null
}

/** One row layout used by the dashboard, the member's list and the queue. */
export function RequestList({
  requests,
  showRequester = false,
  linkTo = 'member',
}: {
  requests: Array<RequestRow>
  showRequester?: boolean
  linkTo?: 'member' | 'queue'
}) {
  return (
    <ul className="divide-y divide-border">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            to={linkTo === 'queue' ? '/queue/$id' : '/requests/$id'}
            params={{ id: request.id }}
            className={cn(
              'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3',
              '-mx-3 transition-colors hover:bg-muted',
            )}
          >
            <span className="font-bold text-foreground">
              {request.racket.label}
            </span>

            <span className="text-xs text-muted-foreground">
              {describeString(request)} ·{' '}
              <span className="font-semibold text-foreground">
                {formatTension(request.tensionMain, request.tensionCross)}
              </span>
            </span>

            {showRequester && request.requester && (
              <span className="text-xs text-muted-foreground">
                {m.request_requested_by({ name: request.requester.name })}
              </span>
            )}

            <span className="ml-auto flex items-center gap-3">
              {request.tokenNumber != null && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  {m.request_token_label({ token: request.tokenNumber })}
                </span>
              )}
              {request.neededBy && (
                <span className="text-[11px] font-medium text-primary-ink">
                  {m.queue_needed_by({ date: formatDate(request.neededBy) })}
                </span>
              )}
              <StatusBadge status={request.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
