import { randomUUID } from 'node:crypto'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hashPassword } from 'better-auth/crypto'

import { PrismaClient } from '../../src/generated/prisma/client'
import { DATABASE_URL } from './env'
import { uniqueStamp } from './support'

/**
 * Direct database setup for the state a workflow starts from — "there is a
 * stringer, and a member has an open request" — so each test drives only the
 * part it is about through the UI. Signing up through an invite is covered by
 * the onboarding test; repeating it before every workflow would only make the
 * others slow and fragile.
 */

let client: PrismaClient | undefined
const prisma = () =>
  (client ??= new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: DATABASE_URL }),
  }))

export type TestUser = {
  id: string
  name: string
  email: string
  password: string
}

/**
 * An approved account with a working password login, written the way
 * `prisma/seed.ts` writes the bootstrap admin: better-auth keeps password
 * logins under the "credential" provider, keyed by the user's own id.
 */
export async function createApprovedUser(
  role: 'member' | 'operator' | 'controller' | 'coach' | 'admin',
  displayName: string,
): Promise<TestUser> {
  const stamp = uniqueStamp()
  const user: TestUser = {
    id: randomUUID(),
    name: `${displayName} ${stamp}`,
    email: `${role}-${stamp}@e2e.test`,
    password: 'e2e-password',
  }
  const now = new Date()
  await prisma().user.create({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role,
      status: 'APPROVED',
      approvedAt: now,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: user.id,
          providerId: 'credential',
          password: await hashPassword(user.password),
        },
      },
    },
  })
  return user
}

/**
 * A racket of the member's with an open request on it, as if they had just
 * submitted the request form: status `REQUESTED`, nobody assigned, and the
 * opening event on the timeline.
 */
export async function createOpenRequest(
  member: TestUser,
  options: {
    racket: string
    clubString: string
    tensionMain: number
    tensionCross?: number
  },
) {
  const db = prisma()
  const clubString = await db.clubString.findFirstOrThrow({
    where: { name: options.clubString, active: true },
  })
  const racket = await db.racket.create({
    data: { ownerId: member.id, label: options.racket },
  })
  return db.stringingRequest.create({
    data: {
      racketId: racket.id,
      requesterId: member.id,
      status: 'REQUESTED',
      stringSource: 'CLUB',
      clubStringId: clubString.id,
      tensionMain: options.tensionMain,
      tensionCross: options.tensionCross ?? null,
      events: { create: { actorId: member.id, toStatus: 'REQUESTED' } },
    },
    include: { clubString: true },
  })
}

/**
 * A job the stringer has already strung and marked done, not yet paid — as if
 * they had just been through the queue workflow. Prices are in cents.
 */
export async function createFinishedJob(
  member: TestUser,
  stringer: TestUser,
  options: Parameters<typeof createOpenRequest>[1] & {
    labourPriceCents: number
  },
) {
  const request = await createOpenRequest(member, options)
  const clubString = request.clubString!
  const now = new Date()
  return prisma().stringingRequest.update({
    where: { id: request.id },
    data: {
      status: 'DONE',
      operatorId: stringer.id,
      acceptedAt: now,
      completedAt: now,
      usedStringName: [clubString.name, clubString.gauge]
        .filter(Boolean)
        .join(' '),
      usedTensionMain: options.tensionMain,
      usedTensionCross: options.tensionCross ?? null,
      stringPriceCents: clubString.priceCents,
      labourPriceCents: options.labourPriceCents,
      events: {
        create: [
          {
            actorId: stringer.id,
            fromStatus: 'REQUESTED',
            toStatus: 'ACCEPTED',
          },
          { actorId: stringer.id, fromStatus: 'ACCEPTED', toStatus: 'DONE' },
        ],
      },
    },
  })
}
