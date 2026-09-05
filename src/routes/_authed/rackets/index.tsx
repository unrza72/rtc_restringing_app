import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { listRackets, setRacketArchived } from '#/server/rackets.functions'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'

export const Route = createFileRoute('/_authed/rackets/')({
  validateSearch: z.object({ archived: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ archived: search.archived ?? false }),
  loader: async ({ deps }) => ({
    rackets: await listRackets({ data: { includeArchived: deps.archived } }),
  }),
  component: RacketsPage,
})

function RacketsPage() {
  const { rackets } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const archive = useServerFn(setRacketArchived)

  async function toggleArchived(id: string, archived: boolean) {
    await archive({ data: { id, archived } })
    await router.invalidate()
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {m.racket_list_title()}
        </h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to="/rackets"
              search={{ archived: search.archived ? undefined : true }}
            >
              {m.racket_show_archived()}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/rackets/new">{m.racket_add()}</Link>
          </Button>
        </div>
      </div>

      {rackets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.racket_empty()}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rackets.map((racket) => (
            <li key={racket.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <Link
                    to="/rackets/$id"
                    params={{ id: racket.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {racket.label}
                  </Link>

                  <span className="text-sm text-muted-foreground">
                    {[racket.brand, racket.model].filter(Boolean).join(' ') ||
                      m.common_none()}
                  </span>

                  {racket.archived && (
                    <Badge variant="outline">{m.racket_archived()}</Badge>
                  )}

                  <span className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {m.racket_request_count({
                        count: racket._count.requests,
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void toggleArchived(racket.id, !racket.archived)
                      }
                    >
                      {racket.archived
                        ? m.racket_unarchive()
                        : m.racket_archive()}
                    </Button>
                  </span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
