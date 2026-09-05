import { randomUUID } from 'node:crypto'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'

import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

/**
 * Bootstraps the first admin — without one, nobody could ever approve the
 * first member. Safe to re-run: it only fills in what is missing.
 */
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@rtc.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Club Admin'

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

async function seedAdmin() {
  const existing = await prisma.user.findFirst({
    where: { username: ADMIN_USERNAME },
  })
  if (existing) {
    console.log(`↷ admin "${ADMIN_USERNAME}" already exists`)
    return
  }

  const userId = randomUUID()
  const now = new Date()

  await prisma.user.create({
    data: {
      id: userId,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      emailVerified: true,
      username: ADMIN_USERNAME.toLowerCase(),
      displayUsername: ADMIN_USERNAME,
      role: 'admin',
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
          password: await hashPassword(ADMIN_PASSWORD),
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  })

  console.log(
    `✅ admin "${ADMIN_USERNAME}" / "${ADMIN_PASSWORD}" — change this password`,
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

async function main() {
  console.log('🌱 Seeding database…')
  await seedAdmin()
  await seedStrings()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
