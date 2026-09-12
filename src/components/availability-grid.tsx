import { useRef, useState } from 'react'

import {
  WEEKDAYS,
  cellKey,
  cellsFromSlots,
  formatMinutes,
  gridRowStarts,
  slotSignature,
  slotsFromCells,
  slotsOutsideWindow,
} from '#/lib/training'
import type { GridWindow, Slot } from '#/lib/training'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

/**
 * A week at a glance: drag across cells to paint availability, drag across
 * filled ones to rub it out. Whether the cell you start on was filled decides
 * which of the two the whole stroke does, so a drag never flip-flops.
 *
 * Saving is deferred to the end of a stroke rather than fired per cell — one
 * request per gesture instead of one per half hour.
 */
export function AvailabilityGrid({
  slots,
  gridWindow,
  onSave,
  saving,
}: {
  slots: Array<Slot>
  gridWindow: GridWindow
  onSave: (slots: Array<Slot>) => void
  saving: boolean
}) {
  const [selected, setSelected] = useState(() =>
    cellsFromSlots(slots, gridWindow),
  )
  // Painting true = filling, false = erasing, null = not in a stroke.
  const painting = useRef<boolean | null>(null)
  const surface = useRef<HTMLDivElement>(null)

  // Re-sync when the server sends a different week than the one we are showing
  // (another tab, or the precise editor below). Adjusting state during render
  // beats an effect: no extra paint with the stale week on screen.
  // Changing the window is a re-read too: a wider one exposes cells that were
  // not on screen a moment ago.
  const incoming = `${slotSignature(slots)}@${gridWindow.startMin}-${gridWindow.endMin}`
  const [syncedFrom, setSyncedFrom] = useState(incoming)
  if (incoming !== syncedFrom) {
    setSyncedFrom(incoming)
    setSelected(cellsFromSlots(slots, gridWindow))
  }

  const rows = gridRowStarts(gridWindow)

  function apply(key: string, fill: boolean) {
    setSelected((current) => {
      if (current.has(key) === fill) return current
      const next = new Set(current)
      if (fill) next.add(key)
      else next.delete(key)
      return next
    })
  }

  /** The cell under the pointer — works for mouse and touch alike. */
  function cellAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y)
    return el instanceof HTMLElement ? (el.dataset.cell ?? null) : null
  }

  function handleDown(event: React.PointerEvent<HTMLDivElement>) {
    const key = cellAt(event.clientX, event.clientY)
    if (!key) return
    painting.current = !selected.has(key)
    apply(key, painting.current)
    // Capture so a stroke that wanders off the grid still ends cleanly.
    surface.current?.setPointerCapture(event.pointerId)
  }

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (painting.current === null) return
    const key = cellAt(event.clientX, event.clientY)
    if (key) apply(key, painting.current)
  }

  function handleUp(event: React.PointerEvent<HTMLDivElement>) {
    if (painting.current === null) return
    painting.current = null
    surface.current?.releasePointerCapture(event.pointerId)
    // Pointer-up is its own event, so the moves before it have already been
    // flushed and `selected` is the finished stroke. Hours outside the drawn
    // window are carried over untouched — the grid never saw them.
    const next = [
      ...slotsOutsideWindow(slots, gridWindow),
      ...slotsFromCells(selected),
    ]
    if (slotSignature(next) !== slotSignature(slots)) onSave(next)
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <div
          ref={surface}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          // Without this a touch drag scrolls the page instead of painting.
          className="min-w-[34rem] touch-none select-none"
        >
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] gap-px">
            <div />
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-1.5 text-center text-[11px] font-bold tracking-wide text-slate-400 uppercase"
              >
                {m[`training_weekday_short_${day}`]()}
              </div>
            ))}

            {rows.map((startMin) => {
              const onTheHour = startMin % 60 === 0
              return (
                <div key={startMin} className="contents">
                  <div
                    className={cn(
                      'pr-2 text-right font-mono text-[11px] leading-5',
                      onTheHour ? 'text-slate-400' : 'text-transparent',
                    )}
                  >
                    {formatMinutes(startMin)}
                  </div>
                  {WEEKDAYS.map((day) => {
                    const key = cellKey(day, startMin)
                    const on = selected.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        data-cell={key}
                        aria-pressed={on}
                        aria-label={`${m[`training_weekday_${day}`]()} ${formatMinutes(startMin)}`}
                        className={cn(
                          'h-5 rounded-[3px] transition-colors',
                          onTheHour && 'border-t border-t-slate-700/70',
                          on
                            ? 'bg-lime-400 hover:bg-lime-300'
                            : 'bg-slate-900 hover:bg-slate-700',
                        )}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {saving ? m.common_saving() : m.training_grid_hint()}
      </p>
    </div>
  )
}
