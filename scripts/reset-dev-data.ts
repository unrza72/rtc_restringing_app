/**
 * Wipes app data and re-runs the seed. Handy after the e2e script, which leaves
 * throwaway members and requests behind. Never point this at a real database.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import { PrismaClient } from '../src/generated/prisma/client.js'

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  }),
})

await prisma.requestEvent.deleteMany()
await prisma.reimbursement.deleteMany()
await prisma.stringingRequest.deleteMany()
await prisma.racket.deleteMany()
await prisma.session.deleteMany()
await prisma.account.deleteMany()
await prisma.user.deleteMany()

console.log('🧹 app data cleared — run `pnpm db:seed` to recreate the admin')
await prisma.$disconnect()
