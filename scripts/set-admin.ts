/**
 * Creates an admin, or sets a new password on an existing account and makes
 * it an admin. For the first deployment and for an admin who is locked out:
 *
 *   pnpm admin:set admin@example.org
 *   pnpm admin:set admin@example.org --name "Club Admin"
 *
 * Asks for the password twice without echoing it, so it never lands in
 * `.env` or the shell history. Piped input (`… < file`) is read as the
 * password instead, for scripting. Setting a password signs that account out
 * everywhere.
 */
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hashPassword } from 'better-auth/crypto'

import { PrismaClient } from '../src/generated/prisma/client.js'
import { parseRoles, serializeRoles } from '../src/lib/roles.js'

// Longer than the 8 members need: this account approves everyone else.
const MIN_LENGTH = 12
// better-auth's own upper limit; a longer password could never sign in.
const MAX_LENGTH = 128

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { name: { type: 'string' } },
})
const email = positionals[0]?.trim().toLowerCase()
if (!email || !email.includes('@') || positionals.length > 1) {
  fail('Usage: pnpm admin:set <email> [--name "Full Name"]')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl)
  fail('DATABASE_URL is not set: run this through pnpm admin:set.')

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
})

try {
  const existing = await prisma.user.findFirst({ where: { email } })
  const name = values.name?.trim() || existing?.name
  if (!name) fail('No account with this email yet: add --name "Full Name".')

  const password = await readPassword()
  const hash = await hashPassword(password)
  const now = new Date()

  // In the member audit log with no actor: it was done on the server itself.
  const audit = (targetId: string, fromValue: string | null, toValue: string) =>
    prisma.memberAuditEntry.create({
      data: {
        action: 'ADMIN_SET',
        targetId,
        targetName: name,
        targetEmail: email,
        fromValue,
        toValue,
      },
    })

  if (existing) {
    const role = serializeRoles([...parseRoles(existing.role), 'admin'])
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          role,
          status: 'APPROVED',
          approvedAt: existing.approvedAt ?? now,
          banned: false,
          updatedAt: now,
        },
      }),
      // better-auth keeps password logins under the "credential" provider,
      // keyed by the user's own id.
      prisma.account.deleteMany({
        where: { userId: existing.id, providerId: 'credential' },
      }),
      prisma.account.create({
        data: {
          id: randomUUID(),
          userId: existing.id,
          accountId: existing.id,
          providerId: 'credential',
          password: hash,
          createdAt: now,
          updatedAt: now,
        },
      }),
      // Whoever knew the old password is signed out too.
      prisma.session.deleteMany({ where: { userId: existing.id } }),
      audit(existing.id, existing.role ?? 'member', role),
    ])
    console.log(`✅ ${email}: new password set, admin, signed out everywhere`)
  } else {
    const userId = randomUUID()
    const create = prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        role: 'admin',
        status: 'APPROVED',
        approvedAt: now,
        // The welcome tour is for members; it can be replayed from the dashboard.
        onboardedAt: now,
        createdAt: now,
        updatedAt: now,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: 'credential',
            password: hash,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    })
    await prisma.$transaction([create, audit(userId, null, 'admin')])
    console.log(`✅ ${email}: admin account created`)
  }
} finally {
  await prisma.$disconnect()
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const piped = (await readAll()).split(/\r?\n/)[0] ?? ''
    checkPassword(piped)
    return piped
  }
  for (;;) {
    const first = await promptHidden('New password: ')
    const problem = passwordProblem(first)
    if (problem) {
      console.error(problem)
      continue
    }
    if ((await promptHidden('Repeat it: ')) === first) return first
    console.error('The two passwords differ, try again.')
  }
}

function passwordProblem(password: string) {
  if (password.length < MIN_LENGTH)
    return `Use at least ${MIN_LENGTH} characters.`
  if (password.length > MAX_LENGTH)
    return `Use at most ${MAX_LENGTH} characters.`
  return null
}

function checkPassword(password: string) {
  const problem = passwordProblem(password)
  if (problem) fail(problem)
}

/** Reads one line from the terminal without echoing it. */
function promptHidden(question: string) {
  return new Promise<string>((resolve) => {
    const stdin = process.stdin
    process.stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let input = ''
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(input)
          return
        }
        if (char === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\n')
          process.exit(130)
        }
        if (char === '\u007f' || char === '\b') input = input.slice(0, -1)
        else if (char >= ' ') input += char
      }
    }
    stdin.on('data', onData)
  })
}

async function readAll() {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data
}

function fail(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}
