import { PrismaPg } from '@prisma/adapter-pg'

/**
 * The PostgreSQL driver adapter for a `DATABASE_URL`, shared by the app, the
 * seed and the scripts. A `?schema=` parameter (what the Prisma CLI reads) is
 * passed on to the adapter, so the app and `prisma migrate` agree on where the
 * tables are: the UI tests use `?schema=e2e` next to the dev data in `public`.
 */
export function createPgAdapter(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')
  const url = new URL(databaseUrl)
  const schema = url.searchParams.get('schema') ?? undefined
  url.searchParams.delete('schema')
  return new PrismaPg(
    { connectionString: url.toString() },
    schema ? { schema } : undefined,
  )
}
