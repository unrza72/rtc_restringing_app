import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { TableHead } from '#/components/ui/table'
import { cn } from '#/lib/utils'

export type SortDir = 'asc' | 'desc'

/**
 * Click a header to sort by it; click the active one again to flip direction.
 * Pass `null` as the initial key to start unsorted (server order) until the
 * user picks a column.
 */
export function useTableSort<TKey extends string>(initialKey: TKey | null) {
  const [sortKey, setSortKey] = useState<TKey | null>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: TKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return { sortKey, sortDir, toggleSort }
}

export function SortableHead<TKey extends string>({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: TKey
  active: boolean
  dir: SortDir
  onSort: (key: TKey) => void
  className?: string
}) {
  const Icon = !active
    ? ChevronsUpDown
    : dir === 'asc'
      ? ChevronUp
      : ChevronDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'flex items-center gap-1 transition-colors hover:text-slate-100',
          className?.includes('text-right') && 'ml-auto',
          active && 'text-slate-100',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'text-slate-600')} />
      </button>
    </TableHead>
  )
}
