/**
 * Unit checks for the grouping solver. Pure in-memory — no database, no dev
 * server; `pnpm test:solver` runs it in a fraction of a second.
 */
import { solve } from '../src/solver/solve.js'
import type {
  Ball,
  SolveOptions,
  SolveResult,
  Slot,
  Trainee,
  Trainer,
} from '../src/solver/types.js'

const MON = 0
const TUE = 1

const hm = (hour: number, minute = 0) => hour * 60 + minute
const at = (weekday: number, from: number, to: number): Slot => ({
  weekday,
  startMin: from,
  endMin: to,
})

const trainee = (
  id: string,
  ball: Ball,
  strength: number,
  ...availability: Array<Slot>
): Trainee => ({ id, ball, strength, availability })

const trainer = (id: string, ...availability: Array<Slot>): Trainer => ({
  id,
  availability,
})

const BASE: SolveOptions = {
  minGroupSize: 2,
  maxGroupSize: 4,
  strengthSpread: 1,
  sessionMinutes: 60,
  slotStepMinutes: 30,
  courtCount: 2,
}
const opts = (over: Partial<SolveOptions> = {}): SolveOptions => ({
  ...BASE,
  ...over,
})

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

const reasonFor = (result: SolveResult, id: string) =>
  result.unplaced.find((u) => u.traineeId === id)?.reason

console.log('\n— a plain group —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: [
      trainee('a', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('c', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('d', 'YELLOW', 2, at(MON, hm(17), hm(19))),
    ],
    options: opts(),
  })
  check(
    'four compatible trainees become one group',
    result.groups.length === 1,
    result,
  )
  check(
    'the group holds all four',
    result.groups[0]?.traineeIds.length === 4,
    result.groups,
  )
  check(
    'it starts at 17:00 and runs an hour',
    result.groups[0]?.startMin === hm(17) &&
      result.groups[0]?.endMin === hm(18),
    result.groups,
  )
  check('nobody is left over', result.unplaced.length === 0, result.unplaced)
}

console.log('\n— group size bounds —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: Array.from({ length: 6 }, (_, i) =>
      trainee(`p${i}`, 'YELLOW', 2, at(MON, hm(17), hm(19))),
    ),
    options: opts({ maxGroupSize: 3 }),
  })
  check(
    'six trainees and a cap of three make two groups',
    result.groups.length === 2,
    result.groups,
  )
  check(
    'no group exceeds the maximum',
    result.groups.every((g) => g.traineeIds.length <= 3),
    result.groups,
  )
  check(
    'the two groups do not overlap in time',
    result.groups[0].endMin <= result.groups[1].startMin,
    result.groups,
  )
}
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: [trainee('lonely', 'YELLOW', 2, at(MON, hm(17), hm(19)))],
    options: opts({ minGroupSize: 2 }),
  })
  check(
    'a single trainee never forms a below-minimum group',
    result.groups.length === 0,
    result.groups,
  )
  check(
    'and is reported as having no compatible group',
    reasonFor(result, 'lonely') === 'NO_COMPATIBLE_GROUP',
    result.unplaced,
  )
}

console.log('\n— ball type is a hard wall —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: [
      trainee('r1', 'RED', 2, at(MON, hm(17), hm(19))),
      trainee('r2', 'RED', 2, at(MON, hm(17), hm(19))),
      trainee('y1', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('y2', 'YELLOW', 2, at(MON, hm(17), hm(19))),
    ],
    options: opts(),
  })
  check(
    'reds and yellows split into two groups',
    result.groups.length === 2,
    result.groups,
  )
  const mixed = result.groups.some(
    (g) =>
      g.traineeIds.some((id) => id.startsWith('r')) &&
      g.traineeIds.some((id) => id.startsWith('y')),
  )
  check('no group mixes ball types', !mixed, result.groups)
}

console.log('\n— strength spread —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(20)))],
    trainees: [
      trainee('s0', 'YELLOW', 0, at(MON, hm(17), hm(20))),
      trainee('s1', 'YELLOW', 1, at(MON, hm(17), hm(20))),
      trainee('s2', 'YELLOW', 2, at(MON, hm(17), hm(20))),
      trainee('s3', 'YELLOW', 3, at(MON, hm(17), hm(20))),
    ],
    options: opts({ strengthSpread: 1 }),
  })
  const strength = (id: string) => Number(id.slice(1))
  const worst = Math.max(
    ...result.groups.map((g) => {
      const values = g.traineeIds.map(strength)
      return Math.max(...values) - Math.min(...values)
    }),
  )
  check('a spread of 1 is never exceeded', worst <= 1, result.groups)
  check(
    'which forces pairs rather than one big group',
    result.groups.every((g) => g.traineeIds.length === 2),
    result.groups,
  )
}
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(20)))],
    trainees: [
      trainee('s0', 'YELLOW', 0, at(MON, hm(17), hm(20))),
      trainee('s1', 'YELLOW', 1, at(MON, hm(17), hm(20))),
      trainee('s2', 'YELLOW', 2, at(MON, hm(17), hm(20))),
      trainee('s3', 'YELLOW', 3, at(MON, hm(17), hm(20))),
    ],
    options: opts({ strengthSpread: 5 }),
  })
  check(
    'a wide spread lets all four train together',
    result.groups.length === 1 && result.groups[0].traineeIds.length === 4,
    result.groups,
  )
}

console.log('\n— courts and trainers are capacity —')
{
  const people = [
    trainee('a', 'YELLOW', 2, at(MON, hm(17), hm(18))),
    trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(18))),
    trainee('c', 'YELLOW', 2, at(MON, hm(17), hm(18))),
    trainee('d', 'YELLOW', 2, at(MON, hm(17), hm(18))),
  ]
  const trainers = [
    trainer('t1', at(MON, hm(17), hm(18))),
    trainer('t2', at(MON, hm(17), hm(18))),
  ]
  const oneCourt = solve({
    trainers,
    trainees: people,
    options: opts({ minGroupSize: 2, maxGroupSize: 2, courtCount: 1 }),
  })
  check(
    'one court allows only one simultaneous group',
    oneCourt.groups.length === 1,
    oneCourt.groups,
  )

  const twoCourts = solve({
    trainers,
    trainees: people,
    options: opts({ minGroupSize: 2, maxGroupSize: 2, courtCount: 2 }),
  })
  check(
    'two courts allow both groups at once',
    twoCourts.groups.length === 2,
    twoCourts.groups,
  )
  check(
    'and they land on different courts',
    twoCourts.groups[0].court !== twoCourts.groups[1].court,
    twoCourts.groups,
  )
}
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(18)))],
    trainees: [
      trainee('a', 'YELLOW', 2, at(MON, hm(17), hm(18))),
      trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(18))),
      trainee('c', 'YELLOW', 2, at(MON, hm(17), hm(18))),
      trainee('d', 'YELLOW', 2, at(MON, hm(17), hm(18))),
    ],
    options: opts({ minGroupSize: 2, maxGroupSize: 2, courtCount: 4 }),
  })
  check(
    'a lone trainer cannot run two groups at once',
    result.groups.length === 1,
    result.groups,
  )
}

console.log('\n— the session must fit —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: [
      trainee('full1', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('full2', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('short', 'YELLOW', 2, at(MON, hm(17), hm(17) + 45)),
    ],
    options: opts(),
  })
  check(
    'a 45-minute window cannot host a 60-minute session',
    !result.groups.some((g) => g.traineeIds.includes('short')),
    result.groups,
  )
  check(
    'the two who fit still train',
    result.groups[0]?.traineeIds.length === 2,
    result.groups,
  )
}
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17, 10), hm(18, 30)))],
    trainees: [
      trainee('a', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(19))),
    ],
    options: opts(),
  })
  check(
    'starts snap to the 30-minute grid, not to 17:10',
    result.groups[0]?.startMin === hm(17, 30),
    result.groups,
  )
}

console.log('\n— why someone was left out —')
{
  const result = solve({
    trainers: [trainer('t1', at(MON, hm(17), hm(19)))],
    trainees: [
      trainee('a', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(19))),
      trainee('silent', 'YELLOW', 2),
      trainee('wrongday', 'YELLOW', 2, at(TUE, hm(17), hm(19))),
      trainee('alone', 'RED', 0, at(MON, hm(17), hm(19))),
    ],
    options: opts(),
  })
  check(
    'no availability at all is reported as such',
    reasonFor(result, 'silent') === 'NO_AVAILABILITY',
    result.unplaced,
  )
  check(
    'free only when no trainer is says so',
    reasonFor(result, 'wrongday') === 'NO_TRAINER_OVERLAP',
    result.unplaced,
  )
  check(
    'a lone red player has no compatible peers',
    reasonFor(result, 'alone') === 'NO_COMPATIBLE_GROUP',
    result.unplaced,
  )
  check(
    'the placed pair is not in the unplaced list',
    !result.unplaced.some((u) => u.traineeId === 'a' || u.traineeId === 'b'),
    result.unplaced,
  )
}

console.log('\n— the same input always gives the same plan —')
{
  const trainers = [
    trainer('t1', at(MON, hm(17), hm(20))),
    trainer('t2', at(MON, hm(17), hm(20))),
  ]
  const trainees = [
    trainee('a', 'YELLOW', 1, at(MON, hm(17), hm(20))),
    trainee('b', 'YELLOW', 2, at(MON, hm(17), hm(20))),
    trainee('c', 'RED', 0, at(MON, hm(17), hm(20))),
    trainee('d', 'RED', 1, at(MON, hm(17), hm(20))),
    trainee('e', 'YELLOW', 1, at(MON, hm(17), hm(20))),
    trainee('f', 'RED', 0, at(MON, hm(17), hm(20))),
  ]
  const first = solve({ trainers, trainees, options: opts() })
  const again = solve({ trainers, trainees, options: opts() })
  check(
    're-running is byte-identical',
    JSON.stringify(first) === JSON.stringify(again),
  )

  const shuffled = solve({
    trainers: [...trainers].reverse(),
    trainees: [...trainees].reverse(),
    options: opts(),
  })
  check(
    'input order does not change the plan',
    JSON.stringify(first) === JSON.stringify(shuffled),
    { first: first.groups, shuffled: shuffled.groups },
  )
}

console.log('\n— nonsense options are refused —')
{
  const bad = (over: Partial<SolveOptions>) => {
    try {
      solve({ trainers: [], trainees: [], options: opts(over) })
      return false
    } catch {
      return true
    }
  }
  check('max below min throws', bad({ minGroupSize: 4, maxGroupSize: 2 }))
  check('a zero-minute session throws', bad({ sessionMinutes: 0 }))
  check('zero courts throws', bad({ courtCount: 0 }))
  check('a negative spread throws', bad({ strengthSpread: -1 }))
}

console.log(
  `\n${failures === 0 ? '✅ all solver checks passed' : `❌ ${failures} solver check(s) failed`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
