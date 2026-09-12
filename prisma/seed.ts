import { randomUUID } from 'node:crypto'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'

import { PrismaClient } from '../src/generated/prisma/client.js'
import { DEV_LOGIN_ROSTER } from '../src/lib/dev-quick-login.js'
import {
  devQuickLoginPassword,
  isDevQuickLoginEnabled,
} from '../src/lib/dev-quick-login.server.js'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

/**
 * Bootstraps the first admin — without one, nobody could ever approve the
 * first member. Safe to re-run: it only fills in what is missing.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@rtc.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Club Admin'

const DAY_MS = 24 * 60 * 60 * 1000

const CLUB_STRINGS = [
  { name: 'Babolat RPM Blast', gauge: '1.25', priceCents: 2200, sortOrder: 10 },
  { name: 'Luxilon ALU Power', gauge: '1.25', priceCents: 2500, sortOrder: 20 },
  { name: 'Head Velocity MLT', gauge: '1.30', priceCents: 1900, sortOrder: 30 },
  {
    name: 'Wilson Synthetic Gut',
    gauge: '1.30',
    priceCents: 1400,
    sortOrder: 40,
  },
]

/**
 * Creates an approved user with a working password login, unless one with
 * this email already exists. Shared by the admin bootstrap and the dev
 * quick-login roster below — both need the same User + Account shape.
 */
async function createApprovedUser({
  email,
  password,
  name,
  role,
}: {
  email: string
  password: string
  name: string
  role: string
}) {
  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) return false

  const userId = randomUUID()
  const now = new Date()

  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role,
      status: 'APPROVED',
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: randomUUID(),
          // better-auth stores password logins under the "credential" provider,
          // keyed by the user's own id and scoped by issuer (1.7+).
          issuer: createLocalAccountIssuer('credential'),
          accountId: userId,
          providerId: 'credential',
          password: await hashPassword(password),
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  })

  return true
}

async function seedAdmin() {
  const created = await createApprovedUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: ADMIN_NAME,
    role: 'admin',
  })
  console.log(
    created
      ? `✅ admin "${ADMIN_EMAIL}" / "${ADMIN_PASSWORD}" — change this password`
      : `↷ admin "${ADMIN_EMAIL}" already exists`,
  )
}

/**
 * Spike devtools only — six fixed, known-password accounts (1 admin, 2
 * stringers, 3 members) so the login page's quick-login buttons have someone
 * to sign in as. Off unless DEV_QUICK_LOGIN_ENABLED=true; never run this
 * against a real deployment.
 */
async function seedDevQuickLoginUsers() {
  if (!isDevQuickLoginEnabled()) {
    console.log(
      '↷ dev quick-login roster skipped (DEV_QUICK_LOGIN_ENABLED not set)',
    )
    return
  }

  const password = devQuickLoginPassword()
  let created = 0
  for (const entry of DEV_LOGIN_ROSTER) {
    const wasCreated = await createApprovedUser({
      email: entry.email,
      password,
      name: entry.name,
      role: entry.role,
    })
    if (wasCreated) created += 1
  }
  console.log(
    `✅ dev quick-login roster: ${created} account(s) created, password "${password}"`,
  )
}

async function seedStrings() {
  let added = 0
  for (const clubString of CLUB_STRINGS) {
    const existing = await prisma.clubString.findFirst({
      where: { name: clubString.name, gauge: clubString.gauge },
    })
    if (existing) continue
    await prisma.clubString.create({ data: clubString })
    added += 1
  }
  console.log(`✅ ${added} club string(s) added`)
}

/** Days before now, for readable-relative-timestamp seed data. */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

type DemoRequestSpec = {
  racketId: string
  requesterId: string
  clubStringId: string
  tensionMain: number
  tensionCross?: number | null
  memberNotes?: string | null
  status: 'REQUESTED' | 'ACCEPTED' | 'DONE' | 'COLLECTED'
  operatorId?: string | null
  usedStringName?: string | null
  usedTensionMain?: number | null
  stringPriceCents?: number | null
  labourPriceCents?: number | null
  paidById?: string | null
  createdAt: Date
}

/**
 * One request plus the RequestEvent trail that would have produced it —
 * built by hand here since this bypasses the real transition() state machine,
 * but the request detail page's timeline expects that trail to exist.
 */
async function seedDemoRequest(spec: DemoRequestSpec) {
  const { status, operatorId = null, paidById = null, createdAt } = spec
  const acceptedAt =
    status === 'REQUESTED' ? null : new Date(createdAt.getTime() + DAY_MS)
  const completedAt =
    status === 'DONE' || status === 'COLLECTED'
      ? new Date((acceptedAt ?? createdAt).getTime() + DAY_MS)
      : null
  const collectedAt =
    status === 'COLLECTED'
      ? new Date((completedAt ?? createdAt).getTime() + DAY_MS)
      : null

  const request = await prisma.stringingRequest.create({
    data: {
      racketId: spec.racketId,
      requesterId: spec.requesterId,
      status,
      stringSource: 'CLUB',
      clubStringId: spec.clubStringId,
      tensionMain: spec.tensionMain,
      tensionCross: spec.tensionCross ?? null,
      memberNotes: spec.memberNotes ?? null,
      operatorId,
      acceptedAt,
      completedAt,
      collectedAt,
      usedStringName: spec.usedStringName ?? null,
      usedTensionMain: spec.usedTensionMain ?? null,
      stringPriceCents: spec.stringPriceCents ?? null,
      labourPriceCents: spec.labourPriceCents ?? null,
      paidAt: paidById ? completedAt : null,
      paidById,
      createdAt,
      updatedAt: collectedAt ?? completedAt ?? acceptedAt ?? createdAt,
    },
  })

  const events: Array<{
    actorId: string
    fromStatus: string | null
    toStatus: string
    createdAt: Date
  }> = [
    {
      actorId: spec.requesterId,
      fromStatus: null,
      toStatus: 'REQUESTED',
      createdAt,
    },
  ]
  if (acceptedAt) {
    events.push({
      actorId: operatorId!,
      fromStatus: 'REQUESTED',
      toStatus: 'ACCEPTED',
      createdAt: acceptedAt,
    })
  }
  if (completedAt) {
    events.push({
      actorId: operatorId!,
      fromStatus: 'ACCEPTED',
      toStatus: 'DONE',
      createdAt: completedAt,
    })
  }
  if (collectedAt) {
    events.push({
      actorId: spec.requesterId,
      fromStatus: 'DONE',
      toStatus: 'COLLECTED',
      createdAt: collectedAt,
    })
  }
  await prisma.requestEvent.createMany({
    data: events.map((e) => ({ ...e, requestId: request.id })),
  })
}

/**
 * A handful of rackets and requests spanning every status, so the dashboard,
 * queue and billing pages have something to show. Tied to the dev quick-login
 * roster — there is no realistic member account to own these without it.
 */
async function seedSampleRacketsAndRequests() {
  if (!isDevQuickLoginEnabled()) {
    console.log(
      '↷ sample rackets/requests skipped (needs DEV_QUICK_LOGIN_ENABLED)',
    )
    return
  }

  const emailOf = (slot: string) =>
    DEV_LOGIN_ROSTER.find((u) => u.slot === slot)!.email
  const [member1, member2, member3, stringer1, stringer2, admin] =
    await Promise.all([
      prisma.user.findFirst({ where: { email: emailOf('member-1') } }),
      prisma.user.findFirst({ where: { email: emailOf('member-2') } }),
      prisma.user.findFirst({ where: { email: emailOf('member-3') } }),
      prisma.user.findFirst({ where: { email: emailOf('stringer-1') } }),
      prisma.user.findFirst({ where: { email: emailOf('stringer-2') } }),
      prisma.user.findFirst({ where: { email: ADMIN_EMAIL } }),
    ])
  if (!member1 || !member2 || !member3 || !stringer1 || !stringer2 || !admin) {
    console.log('↷ sample rackets/requests skipped (roster not fully seeded)')
    return
  }

  const existing = await prisma.racket.findFirst({
    where: { ownerId: member1.id, label: 'Blue Pure Drive' },
  })
  if (existing) {
    console.log('↷ sample rackets/requests already seeded')
    return
  }

  const rpmBlast = await prisma.clubString.findFirst({
    where: { name: 'Babolat RPM Blast' },
  })
  const aluPower = await prisma.clubString.findFirst({
    where: { name: 'Luxilon ALU Power' },
  })
  const velocityMlt = await prisma.clubString.findFirst({
    where: { name: 'Head Velocity MLT' },
  })
  if (!rpmBlast || !aluPower || !velocityMlt) {
    console.log('↷ sample rackets/requests skipped (string catalogue missing)')
    return
  }

  const [r1, r2, r3, r4] = await Promise.all([
    prisma.racket.create({
      data: {
        ownerId: member1.id,
        label: 'Blue Pure Drive',
        brand: 'Babolat',
        model: 'Pure Drive 100',
        headSizeCm2: 645,
        stringPattern: '16x19',
        gripSize: 'L2',
      },
    }),
    prisma.racket.create({
      data: {
        ownerId: member2.id,
        label: 'Pure Aero',
        brand: 'Babolat',
        model: 'Pure Aero 2023',
        headSizeCm2: 630,
        stringPattern: '16x19',
        gripSize: 'L3',
      },
    }),
    prisma.racket.create({
      data: {
        ownerId: member3.id,
        label: 'Blade 98',
        brand: 'Wilson',
        model: 'Blade 98 v8',
        headSizeCm2: 630,
        stringPattern: '16x19',
        gripSize: 'L2',
      },
    }),
    prisma.racket.create({
      data: {
        ownerId: member1.id,
        label: 'Backup racket',
        brand: 'Head',
        model: 'Speed MP',
        headSizeCm2: 630,
        stringPattern: '16x19',
        gripSize: 'L2',
      },
    }),
  ])

  // Fresh, unclaimed — shows up as "open" on the dashboard and in the queue.
  await seedDemoRequest({
    racketId: r1.id,
    requesterId: member1.id,
    clubStringId: rpmBlast.id,
    tensionMain: 24,
    tensionCross: 23,
    memberNotes: 'Same as always, thanks!',
    status: 'REQUESTED',
    createdAt: daysAgo(1),
  })

  // Claimed, on the machine — shows up in the queue as "being strung".
  await seedDemoRequest({
    racketId: r2.id,
    requesterId: member2.id,
    clubStringId: aluPower.id,
    tensionMain: 25,
    status: 'ACCEPTED',
    operatorId: stringer1.id,
    createdAt: daysAgo(3),
  })

  // Finished but the member hasn't paid yet — shows "Unpaid" in /billing and
  // counts toward stringer1's outstanding balance in /billing/payouts.
  await seedDemoRequest({
    racketId: r3.id,
    requesterId: member3.id,
    clubStringId: velocityMlt.id,
    tensionMain: 23,
    tensionCross: 22,
    status: 'DONE',
    operatorId: stringer1.id,
    usedStringName: 'Head Velocity MLT 1.30',
    usedTensionMain: 23,
    stringPriceCents: velocityMlt.priceCents,
    labourPriceCents: 1000,
    createdAt: daysAgo(6),
  })

  // Finished and paid — shows "Paid" in /billing and is real, reimbursable
  // earnings for stringer2 in /billing/payouts.
  await seedDemoRequest({
    racketId: r4.id,
    requesterId: member1.id,
    clubStringId: aluPower.id,
    tensionMain: 24,
    status: 'DONE',
    operatorId: stringer2.id,
    usedStringName: 'Luxilon ALU Power 1.25',
    usedTensionMain: 24,
    stringPriceCents: aluPower.priceCents,
    labourPriceCents: 1200,
    paidById: admin.id,
    createdAt: daysAgo(10),
  })

  // Fully wrapped up — a second, older request on r1 so its history isn't
  // just the open one above.
  await seedDemoRequest({
    racketId: r1.id,
    requesterId: member1.id,
    clubStringId: rpmBlast.id,
    tensionMain: 24,
    status: 'COLLECTED',
    operatorId: stringer1.id,
    usedStringName: 'Babolat RPM Blast 1.25',
    usedTensionMain: 24,
    stringPriceCents: rpmBlast.priceCents,
    labourPriceCents: 1000,
    paidById: admin.id,
    createdAt: daysAgo(20),
  })

  console.log('✅ sample rackets and requests seeded')
}

/**
 * A training roster with enough overlap to be interesting: three trainers on
 * different evenings, and trainees spread over all four balls so the solver has
 * real choices to make — including a couple who deliberately cannot be placed.
 */
async function seedTrainingRoster() {
  const existing = await prisma.trainingPerson.findFirst({
    where: { name: 'Coach Meier' },
  })
  if (existing) {
    console.log('↷ training roster already seeded')
    return
  }

  const hm = (hour: number, minute = 0) => hour * 60 + minute
  const MON = 0
  const TUE = 1
  const WED = 2
  const THU = 3
  const SAT = 5

  type Slot = [weekday: number, startMin: number, endMin: number]
  const person = (
    name: string,
    kind: 'TRAINEE' | 'TRAINER',
    ball: string | null,
    strength: number | null,
    slots: Array<Slot>,
  ) =>
    prisma.trainingPerson.create({
      data: {
        name,
        kind,
        ball,
        strength,
        availability: {
          create: slots.map(([weekday, startMin, endMin]) => ({
            weekday,
            startMin,
            endMin,
          })),
        },
      },
    })

  await Promise.all([
    person('Coach Meier', 'TRAINER', null, null, [
      [MON, hm(16), hm(20)],
      [WED, hm(16), hm(20)],
    ]),
    person('Coach Schulz', 'TRAINER', null, null, [
      [MON, hm(17), hm(20)],
      [THU, hm(16), hm(19)],
    ]),
    person('Coach Weber', 'TRAINER', null, null, [
      [WED, hm(17), hm(20)],
      [SAT, hm(9), hm(12)],
    ]),

    // Red — the youngest, straight after school.
    person('Mia Braun', 'TRAINEE', 'RED', 0, [[MON, hm(16), hm(18)]]),
    person('Leon Fischer', 'TRAINEE', 'RED', 0, [[MON, hm(16), hm(18)]]),
    person('Emma Wolf', 'TRAINEE', 'RED', 1, [
      [MON, hm(16), hm(18)],
      [WED, hm(16), hm(18)],
    ]),
    person('Noah Richter', 'TRAINEE', 'RED', 1, [[WED, hm(16), hm(18)]]),

    person('Lina Koch', 'TRAINEE', 'ORANGE', 1, [[WED, hm(16), hm(19)]]),
    person('Paul Neumann', 'TRAINEE', 'ORANGE', 2, [[WED, hm(16), hm(19)]]),
    person('Sofia Lang', 'TRAINEE', 'ORANGE', 2, [
      [MON, hm(17), hm(19)],
      [WED, hm(16), hm(19)],
    ]),

    person('Jonas Hofmann', 'TRAINEE', 'GREEN', 2, [[MON, hm(17), hm(20)]]),
    person('Clara Vogel', 'TRAINEE', 'GREEN', 3, [[MON, hm(17), hm(20)]]),
    person('Felix Bauer', 'TRAINEE', 'GREEN', 3, [
      [MON, hm(17), hm(20)],
      [THU, hm(16), hm(19)],
    ]),

    // Yellow — adults, later in the evening.
    person('Anna Schmidt', 'TRAINEE', 'YELLOW', 3, [[MON, hm(18), hm(20)]]),
    person('Tom Krüger', 'TRAINEE', 'YELLOW', 3, [[MON, hm(18), hm(20)]]),
    person('Nina Hartmann', 'TRAINEE', 'YELLOW', 4, [
      [MON, hm(18), hm(20)],
      [SAT, hm(9), hm(12)],
    ]),
    person('David Peters', 'TRAINEE', 'YELLOW', 4, [[SAT, hm(9), hm(12)]]),
    person('Sarah König', 'TRAINEE', 'YELLOW', 5, [[SAT, hm(9), hm(12)]]),

    // Deliberately awkward, so the "not placed" half of a plan is never empty:
    // one who never entered a time, one free only when no trainer is.
    person('Markus Ziegler', 'TRAINEE', 'YELLOW', 2, []),
    person('Julia Sommer', 'TRAINEE', 'YELLOW', 3, [[TUE, hm(19), hm(21)]]),
  ])

  console.log('✅ training roster seeded')
}

async function main() {
  console.log('🌱 Seeding database…')
  await seedAdmin()
  await seedStrings()
  await seedDevQuickLoginUsers()
  await seedSampleRacketsAndRequests()
  await seedTrainingRoster()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
