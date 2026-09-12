import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  DEFAULT_GRID_WINDOW,
  GRID_STEP,
  MINUTES_PER_DAY,
  formatMinutes,
  normaliseWindow,
  parseMinutes,
} from '#/lib/training'
import type { GridWindow } from '#/lib/training'
import { m } from '#/paraglide/messages'
import { Input } from '#/components/ui/input'

/**
 * Which hours the timetables draw. Owned by the /training layout so the roster
 * and the solved plans agree on it, and remembered per browser: a coach who
 * only ever plans weekday evenings wants a short grid, and that is nobody
 * else's business.
 */

const WINDOW_KEY = 'rtc.training.grid-window'

function loadWindow(): GridWindow {
  try {
    const raw = localStorage.getItem(WINDOW_KEY)
    if (!raw) return DEFAULT_GRID_WINDOW
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as GridWindow).startMin !== 'number' ||
      typeof (parsed as GridWindow).endMin !== 'number'
    ) {
      return DEFAULT_GRID_WINDOW
    }
    return normaliseWindow(parsed as GridWindow)
  } catch {
    // Storage throws outright in some privacy modes.
    return DEFAULT_GRID_WINDOW
  }
}

function storeWindow(value: GridWindow) {
  try {
    localStorage.setItem(WINDOW_KEY, JSON.stringify(value))
  } catch {
    // Blocked storage just means the choice will not survive a reload.
  }
}

type GridWindowValue = {
  gridWindow: GridWindow
  setGridWindow: (next: GridWindow) => void
}

const GridWindowContext = createContext<GridWindowValue | null>(null)

export function GridWindowProvider({ children }: { children: ReactNode }) {
  // Starts at the default so the server and the first client render agree;
  // the stored preference is picked up right after mount.
  const [gridWindow, setState] = useState(DEFAULT_GRID_WINDOW)
  useEffect(() => setState(loadWindow()), [])

  const setGridWindow = useCallback((next: GridWindow) => {
    const normalised = normaliseWindow(next)
    setState(normalised)
    storeWindow(normalised)
  }, [])

  return (
    <GridWindowContext.Provider value={{ gridWindow, setGridWindow }}>
      {children}
    </GridWindowContext.Provider>
  )
}

export function useGridWindow() {
  const value = useContext(GridWindowContext)
  if (!value) throw new Error('useGridWindow needs a GridWindowProvider')
  return value
}

/** The two time pickers, rendered once in the training header. */
export function GridWindowPicker() {
  const { gridWindow, setGridWindow } = useGridWindow()

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {m.training_grid_window()}
      </span>
      <Input
        aria-label={m.training_from()}
        type="time"
        step={GRID_STEP * 60}
        value={formatMinutes(gridWindow.startMin)}
        onChange={(e) => {
          const startMin = parseMinutes(e.target.value)
          if (startMin !== null) setGridWindow({ ...gridWindow, startMin })
        }}
        className="h-8 w-24 text-xs"
      />
      <span className="text-slate-600">–</span>
      <Input
        aria-label={m.training_to()}
        type="time"
        step={GRID_STEP * 60}
        // A time input cannot express 24:00, so a window running to midnight
        // shows as 23:59 rather than looping back to the start of the day.
        value={formatMinutes(Math.min(gridWindow.endMin, MINUTES_PER_DAY - 1))}
        onChange={(e) => {
          const endMin = parseMinutes(e.target.value)
          if (endMin !== null) setGridWindow({ ...gridWindow, endMin })
        }}
        className="h-8 w-24 text-xs"
      />
    </div>
  )
}
