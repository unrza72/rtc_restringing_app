import {
  BALL_BADGE,
  GRID_STEP,
  WEEKDAYS,
  assignLanes,
  formatMinutes,
  gridRowStarts,
  normaliseWindow,
} from '#/lib/training'
import type { Ball, GridWindow } from '#/lib/training'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

/** Half a row per cell keeps a 60-minute block tall enough to label. */
const ROW_PX = 26

export type ScheduledGroup = {
  id: string
  weekday: number
  startMin: number
  endMin: number
  ball: string
  court: number
  trainer: { name: string }
  members: Array<{ person: { id: string; name: string } }>
}

/**
 * A solved plan as a week at a glance. Blocks are positioned by the minute
 * rather than snapped to cells, because a plan's session length and start grid
 * are its own knobs and need not line up with the half-hour rows behind them.
 *
 * Groups running at the same time sit side by side in lanes, the way a calendar
 * shows two simultaneous meetings.
 */
export function ScheduleTimetable({
  groups,
  gridWindow,
}: {
  groups: Array<ScheduledGroup>
  gridWindow: GridWindow
}) {
  const { startMin, endMin } = normaliseWindow(gridWindow)
  const rows = gridRowStarts(gridWindow)
  const height = rows.length * ROW_PX

  const visible = groups.filter(
    (g) => g.endMin > startMin && g.startMin < endMin,
  )

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-[3.5rem_repeat(7,1fr)] gap-px">
        <div />
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1.5 text-center text-[11px] font-bold tracking-wide text-slate-400 uppercase"
          >
            {m[`training_weekday_short_${day}`]()}
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {rows.map((rowStart, i) =>
            rowStart % 60 === 0 ? (
              <div
                key={rowStart}
                className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-slate-400"
                style={{ top: i * ROW_PX }}
              >
                {formatMinutes(rowStart)}
              </div>
            ) : null,
          )}
        </div>

        {WEEKDAYS.map((day) => {
          const { items, laneCount } = assignLanes(
            visible.filter((g) => g.weekday === day),
          )
          return (
            <div
              key={day}
              className="relative rounded-sm bg-slate-900/60"
              style={{ height }}
            >
              {rows.map((rowStart, i) => (
                <div
                  key={rowStart}
                  className={cn(
                    'absolute inset-x-0 border-t',
                    rowStart % 60 === 0
                      ? 'border-t-slate-700/60'
                      : 'border-t-slate-800/40',
                  )}
                  style={{ top: i * ROW_PX }}
                />
              ))}

              {items.map((group) => {
                // Clipped to the window so a session that starts before it still
                // shows the part that falls inside.
                const top =
                  ((Math.max(group.startMin, startMin) - startMin) /
                    GRID_STEP) *
                  ROW_PX
                const bottom =
                  ((Math.min(group.endMin, endMin) - startMin) / GRID_STEP) *
                  ROW_PX
                return (
                  <div
                    key={group.id}
                    title={`${group.trainer.name} · ${m.training_group_court({ court: group.court })}\n${group.members.map((mem) => mem.person.name).join(', ')}`}
                    className={cn(
                      'absolute overflow-hidden rounded-md border px-1.5 py-0.5',
                      BALL_BADGE[group.ball as Ball],
                    )}
                    style={{
                      top,
                      height: Math.max(bottom - top - 2, 14),
                      left: `${(group.lane / laneCount) * 100}%`,
                      width: `${(1 / laneCount) * 100}%`,
                    }}
                  >
                    <div className="truncate text-[10px] leading-tight font-bold">
                      {formatMinutes(group.startMin)} {group.trainer.name}
                    </div>
                    <div className="truncate text-[10px] leading-tight opacity-80">
                      {m.training_group_court({ court: group.court })} ·{' '}
                      {group.members.length}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
