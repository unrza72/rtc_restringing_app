/**
 * Unit checks for the timetable grid's slot⇄cell conversion. Pure — this is
 * the logic that decides what actually gets written to a person's availability,
 * so a merging bug here silently corrupts the roster.
 */
import {
  GRID_END,
  GRID_START,
  GRID_STEP,
  cellKey,
  cellsFromSlots,
  fitsGrid,
  gridRowStarts,
  slotSignature,
  slotsFromCells,
} from '../src/lib/training.js'
import type { Slot } from '../src/lib/training.js'

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
const roundTrip = (slots: Array<Slot>) => slotsFromCells(cellsFromSlots(slots))

console.log('\n— the grid itself —')
{
  const rows = gridRowStarts()
  check('starts at the window start', rows[0] === GRID_START, rows[0])
  check(
    'never runs past the window end',
    rows[rows.length - 1] + GRID_STEP === GRID_END,
    rows[rows.length - 1],
  )
  check(
    'is evenly stepped',
    rows.every((t, i) => t === GRID_START + i * GRID_STEP),
    rows,
  )
}

console.log('\n— slots become cells —')
{
  const filled = cellsFromSlots([
    { weekday: MON, startMin: hm(17), endMin: hm(19) },
  ])
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
  const filled = cellsFromSlots([
    { weekday: MON, startMin: hm(17, 10), endMin: hm(18, 40) },
  ])
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
  const filled = cellsFromSlots([
    { weekday: MON, startMin: hm(6), endMin: hm(23, 30) },
  ])
  const rows = gridRowStarts()
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
  const filled = cellsFromSlots([
    { weekday: MON, startMin: hm(17), endMin: hm(17, 20) },
  ])
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
  check('and are reported as fitting the grid', fitsGrid(original))
}
{
  const ragged: Array<Slot> = [
    { weekday: MON, startMin: hm(17, 10), endMin: hm(18, 40) },
  ]
  check('an off-grid slot is reported as not fitting', !fitsGrid(ragged))
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
  check('a slot entirely outside the window does not fit', !fitsGrid(outside))
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

console.log(
  `\n${failures === 0 ? '✅ all timetable checks passed' : `❌ ${failures} timetable check(s) failed`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
