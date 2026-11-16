import 'dotenv/config'
import { PrismaClient } from './generated/prisma/client.js'

import { createPgAdapter } from './db-adapter'

const adapter = createPgAdapter(process.env.DATABASE_URL)

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
