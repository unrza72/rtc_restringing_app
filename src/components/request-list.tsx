import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { STATUS_VARIANT } from '#/lib/status'
import type { RequestStatus } from '#/lib/status'
import {
  describeString,
  formatDate,
  formatTension,
  requestStatusLabel,
} from '#/lib/labels'
import { m } from '#/paraglide/messages'

export type RequestRow = {
  id: string
  status: string
  stringSource: string
  ownStringName: string | null
  tensionMain: number
  tensionCross: number | null
  neededBy: Date | string | null
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
    <ul className="divide-y">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            to={linkTo === 'queue' ? '/queue/$id' : '/requests/$id'}
            params={{ id: request.id }}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 transition-colors hover:bg-accent/40"
          >
            <span className="font-medium">{request.racket.label}</span>

            <span className="text-sm text-muted-foreground">
              {describeString(request)} ·{' '}
              {formatTension(request.tensionMain, request.tensionCross)}
            </span>

            {showRequester && request.requester && (
              <span className="text-sm text-muted-foreground">
                {m.request_requested_by({ name: request.requester.name })}
              </span>
            )}

            <span className="ml-auto flex items-center gap-3">
              {request.neededBy && (
                <span className="text-xs text-muted-foreground">
                  {m.queue_needed_by({ date: formatDate(request.neededBy) })}
                </span>
              )}
              <Badge variant={STATUS_VARIANT[request.status as RequestStatus]}>
                {requestStatusLabel(request.status)}
              </Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
