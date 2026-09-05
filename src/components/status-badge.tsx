import { STATUS_BADGE } from '#/lib/status'
import type { RequestStatus } from '#/lib/status'
import { requestStatusLabel } from '#/lib/labels'
import { cn } from '#/lib/utils'

/**
 * The prototype's status pill: small, uppercase, wide-tracked, with a border
 * that carries the colour rather than a solid fill.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  // Fall back gracefully if the database ever holds a status we retired.
  const tone =
    status in STATUS_BADGE
      ? STATUS_BADGE[status as RequestStatus]
      : 'bg-slate-800 text-slate-300 border-slate-700'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg border px-2.5 py-1',
        'text-[10px] font-bold tracking-wider uppercase',
        tone,
        className,
      )}
    >
      {requestStatusLabel(status)}
    </span>
  )
}
