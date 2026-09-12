/**
 * Unit checks for the timetable grid's slot⇄cell conversion. Pure — this is
 * the logic that decides what actually gets written to a person's availability,
 * so a merging bug here silently corrupts the roster.
 */
import {
  DEFAULT_GRID_WINDOW,
  GRID_STEP,
  MINUTES_PER_DAY,
  assignLanes,
  cellKey,
  cellsFromSlots,
  fitsGrid,
  gridRowStarts,
  normaliseWindow,
  slotSignature,
  slotsFromCells,
  slotsOutsideWindow,
  windowCovering,
} from '../src/lib/training.js'
import type { GridWindow, Slot } from '../src/lib/training.js'

const hm = (hour: number, minute = 0) => hour * 60 + minute
const MON = 0
const WED = 2

let failures = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}`)
  if (!ok) {
    failures++
    if (detail !== undefined) {
      console.log('      ', JSON.stringify(detail).slice(0, 400))
    }
  }
}

const cells = (...keys: Array<string>) => new Set(keys)
const WIN = DEFAULT_GRID_WINDOW
const win = (fromHour: number, toHour: number): GridWindow => ({
  startMin: hm(fromHour),
  endMin: hm(toHour),
})
const roundTrip = (slots: Array<Slot>, window: GridWindow = WIN) =>
  slotsFromCells(cellsFromSlots(slots, window))

console.log('\n— the grid itself —')
{
  const rows = gridRowStarts(WIN)
  check('starts at the window start', rows[0] === WIN.startMin, rows[0])
  check(
    'never runs past the window end',
    rows[rows.length - 1] + GRID_STEP === WIN.endMin,
    rows[rows.length - 1],
  )
  check(
    'is evenly stepped',
    rows.every((t, i) => t === WIN.startMin + i * GRID_STEP),
    rows,
  )
}

console.log('\n— slots become cells —')
{
  const filled = cellsFromSlots(
    [{ weekday: MON, startMin: hm(17), endMin: hm(19) }],
    WIN,
  )
  check('a two-hour slot fills four half-hour cells', filled.size === 4, [
    ...filled,
  ])
  check('the first cell is the slot start', filled.has(cellKey(MON, hm(17))), [
    ...filled,
  ])
  check(
    'the last cell ends exactly on the slot end',
    filled.has(cellKey(MON, hm(18, 30))),
    [...filled],
  )
  check(
    'the cell starting at the slot end is not filled',
    !filled.has(cellKey(MON, hm(19))),
    [...filled],
  )
}
{
  // 17:10–18:40 only fully contains 17:30–18:00 and 18:00–18:30.
  const filled = cellsFromSlots(
    [{ weekday: MON, startMin: hm(17, 10), endMin: hm(18, 40) }],
    WIN,
  )
  check(
    'an off-grid slot keeps only the cells fully inside it',
    filled.size === 2,
    [...filled],
  )
  check(
    'never claiming the ragged edges',
    !filled.has(cellKey(MON, hm(17))) && !filled.has(cellKey(MON, hm(18, 30))),
    [...filled],
  )
}
{
  const filled = cellsFromSlots(
    [{ weekday: MON, startMin: hm(6), endMin: hm(23, 30) }],
    WIN,
  )
  const rows = gridRowStarts(WIN)
  check(
    'a slot wider than the window is clipped to it',
    filled.size === rows.length,
    filled.size,
  )
  check(
    'nothing before the window start survives',
    !filled.has(cellKey(MON, hm(7, 30))),
    [...filled],
  )
}
{
  const filled = cellsFromSlots(
    [{ weekday: MON, startMin: hm(17), endMin: hm(17, 20) }],
    WIN,
  )
  check('a slot shorter than one cell fills nothing', filled.size === 0, [
    ...filled,
  ])
}

console.log('\n— cells become slots —')
{
  const merged = slotsFromCells(
    cells(cellKey(MON, hm(17)), cellKey(MON, hm(17, 30)), cellKey(MON, hm(18))),
  )
  check('three touching cells merge into one slot', merged.length === 1, merged)
  check(
    'spanning the whole painted run',
    merged[0]?.startMin === hm(17) && merged[0]?.endMin === hm(18, 30),
    merged,
  )
}
{
  const merged = slotsFromCells(
    cells(cellKey(MON, hm(17)), cellKey(MON, hm(18, 30))),
  )
  check('a gap splits the run in two', merged.length === 2, merged)
  check(
    'each side keeping its own bounds',
    merged[0]?.endMin === hm(17, 30) && merged[1]?.startMin === hm(18, 30),
    merged,
  )
}
{
  const merged = slotsFromCells(
    cells(cellKey(WED, hm(9)), cellKey(MON, hm(17)), cellKey(MON, hm(17, 30))),
  )
  check('different weekdays never merge together', merged.length === 2, merged)
  check(
    'and come back in weekday order',
    merged[0]?.weekday === MON && merged[1]?.weekday === WED,
    merged,
  )
}
{
  check('no cells means no slots', slotsFromCells(cells()).length === 0)
}

console.log('\n— round trips —')
{
  const original: Array<Slot> = [
    { weekday: MON, startMin: hm(17), endMin: hm(19) },
    { weekday: WED, startMin: hm(9), endMin: hm(10, 30) },
  ]
  check(
    'grid-aligned slots survive untouched',
    slotSignature(roundTrip(original)) === slotSignature(original),
    roundTrip(original),
  )
  check('and are reported as fitting the grid', fitsGrid(original, WIN))
}
{
  const ragged: Array<Slot> = [
    { weekday: MON, startMin: hm(17, 10), endMin: hm(18, 40) },
  ]
  check('an off-grid slot is reported as not fitting', !fitsGrid(ragged, WIN))
  check(
    'and the round trip narrows rather than widens it',
    roundTrip(ragged)[0]?.startMin === hm(17, 30) &&
      roundTrip(ragged)[0]?.endMin === hm(18, 30),
    roundTrip(ragged),
  )
}
{
  const outside: Array<Slot> = [
    { weekday: MON, startMin: hm(6), endMin: hm(7) },
  ]
  check(
    'a slot entirely outside the window does not fit',
    !fitsGrid(outside, WIN),
  )
  check('and round-trips to nothing', roundTrip(outside).length === 0)
}
{
  const adjacent: Array<Slot> = [
    { weekday: MON, startMin: hm(17), endMin: hm(18) },
    { weekday: MON, startMin: hm(18), endMin: hm(19) },
  ]
  // Two touching slots are the same availability as one long one, so the grid
  // rewriting them as a single row is a simplification, not a change.
  check(
    'two touching slots come back merged into one',
    roundTrip(adjacent).length === 1,
    roundTrip(adjacent),
  )
  check(
    'covering the same span',
    roundTrip(adjacent)[0]?.startMin === hm(17) &&
      roundTrip(adjacent)[0]?.endMin === hm(19),
    roundTrip(adjacent),
  )
}

console.log('\n— a configurable window —')
{
  const early = gridRowStarts(win(6, 9))
  check('a custom window starts where asked', early[0] === hm(6), early[0])
  check(
    'and stops before running past its end',
    early[early.length - 1] + GRID_STEP === hm(9),
    early[early.length - 1],
  )
  check('with a row per step', early.length === 6, early.length)
}
{
  const dawn: Array<Slot> = [{ weekday: MON, startMin: hm(6), endMin: hm(7) }]
  check(
    'a 06:00 slot does not fit the default window',
    !fitsGrid(dawn, WIN),
    WIN,
  )
  check(
    'but fits once the window is widened to reach it',
    fitsGrid(dawn, win(6, 22)),
  )
  check(
    'and its cells then appear',
    cellsFromSlots(dawn, win(6, 22)).has(cellKey(MON, hm(6))),
  )
}
{
  const late: Array<Slot> = [{ weekday: MON, startMin: hm(22), endMin: hm(23) }]
  check('a slot past the window end is dropped', !fitsGrid(late, WIN))
  check('and kept when the end is pushed out', fitsGrid(late, win(8, 23)))
}

console.log('\n— hours outside the window are left alone —')
{
  const saturday: Array<Slot> = [
    { weekday: WED, startMin: hm(9), endMin: hm(11) },
    { weekday: MON, startMin: hm(17), endMin: hm(19) },
  ]
  // A coach narrows the grid to weekday evenings, then paints. The morning is
  // off screen and must survive the save that replaces the whole week.
  const narrow = win(16, 21)
  const kept = slotsOutsideWindow(saturday, narrow)
  check('an entirely off-screen slot is carried over', kept.length === 1, kept)
  check(
    'unchanged',
    kept[0]?.weekday === WED &&
      kept[0].startMin === hm(9) &&
      kept[0].endMin === hm(11),
    kept,
  )
  check(
    'while a slot inside the window is not duplicated',
    !kept.some((s) => s.weekday === MON),
    kept,
  )
}
{
  const straddling: Array<Slot> = [
    { weekday: MON, startMin: hm(15), endMin: hm(18) },
  ]
  const kept = slotsOutsideWindow(straddling, win(16, 21))
  check(
    'a slot straddling the start keeps only its early part',
    kept.length === 1,
    kept,
  )
  check(
    'clipped to where the window begins',
    kept[0]?.startMin === hm(15) && kept[0].endMin === hm(16),
    kept,
  )
}
{
  const straddling: Array<Slot> = [
    { weekday: MON, startMin: hm(20), endMin: hm(23) },
  ]
  const kept = slotsOutsideWindow(straddling, win(16, 21))
  check(
    'a slot running past the end keeps only its late part',
    kept[0]?.startMin === hm(21) && kept[0].endMin === hm(23),
    kept,
  )
}
{
  const spanning: Array<Slot> = [
    { weekday: MON, startMin: hm(8), endMin: hm(22) },
  ]
  const kept = slotsOutsideWindow(spanning, win(16, 21))
  check(
    'a slot wrapping the whole window keeps both ends',
    kept.length === 2,
    kept,
  )
}
{
  check(
    'nothing is carried over when everything is on screen',
    slotsOutsideWindow(
      [{ weekday: MON, startMin: hm(17), endMin: hm(19) }],
      WIN,
    ).length === 0,
  )
}

console.log('\n— overlapping sessions get their own lane —')
{
  const back2back = assignLanes([
    { startMin: hm(17), endMin: hm(18) },
    { startMin: hm(18), endMin: hm(19) },
  ])
  check(
    'sessions that merely touch share one lane',
    back2back.laneCount === 1,
    back2back,
  )
}
{
  const clash = assignLanes([
    { startMin: hm(17), endMin: hm(18, 30) },
    { startMin: hm(18), endMin: hm(19) },
  ])
  check('an overlap opens a second lane', clash.laneCount === 2, clash)
  check(
    'and the later one moves over',
    clash.items.find((i) => i.startMin === hm(18))?.lane === 1,
    clash.items,
  )
}
{
  const three = assignLanes([
    { startMin: hm(17), endMin: hm(19) },
    { startMin: hm(17), endMin: hm(19) },
    { startMin: hm(17), endMin: hm(19) },
  ])
  check('three at once need three lanes', three.laneCount === 3, three)
  check(
    'each on a distinct one',
    new Set(three.items.map((i) => i.lane)).size === 3,
    three.items,
  )
}
{
  // The first slot frees up again, so the third session reuses lane 0.
  const reuse = assignLanes([
    { startMin: hm(17), endMin: hm(18) },
    { startMin: hm(17, 30), endMin: hm(18, 30) },
    { startMin: hm(18), endMin: hm(19) },
  ])
  check(
    'a freed lane is reused rather than growing',
    reuse.laneCount === 2,
    reuse,
  )
  check(
    'by the session that starts when it frees up',
    reuse.items.find((i) => i.startMin === hm(18))?.lane === 0,
    reuse.items,
  )
}
{
  const empty = assignLanes([])
  check('nothing to place still reports one lane', empty.laneCount === 1, empty)
  check('and places nothing', empty.items.length === 0)
}
{
  const unsorted = [
    { startMin: hm(19), endMin: hm(20) },
    { startMin: hm(17), endMin: hm(18) },
  ]
  const a = assignLanes(unsorted)
  const b = assignLanes([...unsorted].reverse())
  check(
    'input order does not change the result',
    JSON.stringify(a) === JSON.stringify(b),
    { a, b },
  )
}

console.log('\n— windows are kept sane —')
{
  const snapped = normaliseWindow({ startMin: hm(7, 10), endMin: hm(21, 50) })
  check(
    'the start rounds down onto the step',
    snapped.startMin === hm(7),
    snapped,
  )
  check('the end rounds up onto the step', snapped.endMin === hm(22), snapped)
}
{
  const upsideDown = normaliseWindow({ startMin: hm(20), endMin: hm(9) })
  check(
    'an end before the start still yields one row',
    upsideDown.endMin === upsideDown.startMin + GRID_STEP,
    upsideDown,
  )
  check(
    'and that window renders exactly one row',
    gridRowStarts({ startMin: hm(20), endMin: hm(9) }).length === 1,
  )
}
{
  const clamped = normaliseWindow({ startMin: -120, endMin: 99 * 60 })
  check('a negative start clamps to midnight', clamped.startMin === 0, clamped)
  check(
    'an overlong end clamps to the end of the day',
    clamped.endMin === MINUTES_PER_DAY,
    clamped,
  )
}
{
  const spread: Array<Slot> = [
    { weekday: MON, startMin: hm(6, 30), endMin: hm(8) },
    { weekday: WED, startMin: hm(21), endMin: hm(23) },
  ]
  const covering = windowCovering(spread, WIN)
  check(
    'a covering window reaches the earliest slot',
    covering.startMin === hm(6, 30),
    covering,
  )
  check('and the latest one', covering.endMin === hm(23), covering)
  check('so everything fits inside it', fitsGrid(spread, covering))
  check(
    'and it never shrinks below the fallback',
    windowCovering([], WIN).startMin === WIN.startMin &&
      windowCovering([], WIN).endMin === WIN.endMin,
  )
}

console.log(
  `\n${failures === 0 ? '✅ all timetable checks passed' : `❌ ${failures} timetable check(s) failed`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
