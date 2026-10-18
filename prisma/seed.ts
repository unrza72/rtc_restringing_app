import { randomUUID } from 'node:crypto'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hashPassword } from 'better-auth/crypto'

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
 * first member. That is all it seeds (plus the dev quick-login accounts when
 * switched on): the string catalogue, prices and training roster are the
 * club's to enter. Safe to re-run: it only fills in what is missing.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@rtc.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Club Admin'

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
      // The welcome tour is for members finding their way in; the bootstrap
      // admin and the dev roster skip it (it can be replayed from the
      // dashboard).
      onboardedAt: now,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: randomUUID(),
          // better-auth stores password logins under the "credential" provider,
          // keyed by the user's own id.
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

async function main() {
  console.log('🌱 Seeding database…')
  await seedAdmin()
  await seedDevQuickLoginUsers()
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
