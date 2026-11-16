import { createPgAdapter } from '../../src/db-adapter'
import { PrismaClient } from '../../src/generated/prisma/client'
import { DATABASE_URL } from './env'

/**
 * The string catalogue the specs pick from by name and price. The app's seed
 * leaves the catalogue to the club, so the tests bring their own.
 */
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

const prisma = new PrismaClient({
  adapter: createPgAdapter(DATABASE_URL),
})
await prisma.clubString.createMany({ data: CLUB_STRINGS })
console.log(`✅ ${CLUB_STRINGS.length} test club string(s) added`)
await prisma.$disconnect()
