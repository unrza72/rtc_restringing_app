import { Link, createFileRoute } from '@tanstack/react-router'

import { listMyRequests } from '#/server/requests.functions'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { RequestList } from '#/components/request-list'

export const Route = createFileRoute('/_authed/requests/')({
  loader: async () => ({ requests: await listMyRequests() }),
  component: RequestsPage,
})

function RequestsPage() {
  const { requests } = Route.useLoaderData()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {m.request_list_title()}
        </h1>
        <Button asChild>
          <Link to="/requests/new">{m.dash_new_request()}</Link>
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.request_empty()}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-2">
            <RequestList requests={requests} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
