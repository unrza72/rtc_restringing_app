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
    <ul className="divide-y divide-slate-800">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            to={linkTo === 'queue' ? '/queue/$id' : '/requests/$id'}
            params={{ id: request.id }}
            className={cn(
              'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3',
              '-mx-3 transition-colors hover:bg-slate-800/50',
            )}
          >
            <span className="font-bold text-white">{request.racket.label}</span>

            <span className="text-xs text-slate-400">
              {describeString(request)} ·{' '}
              <span className="font-semibold text-lime-400">
                {formatTension(request.tensionMain, request.tensionCross)}
              </span>
            </span>

            {showRequester && request.requester && (
              <span className="text-xs text-slate-400">
                {m.request_requested_by({ name: request.requester.name })}
              </span>
            )}

            <span className="ml-auto flex items-center gap-3">
              {request.neededBy && (
                <span className="text-[11px] text-amber-400">
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
