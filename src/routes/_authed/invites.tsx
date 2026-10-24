import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  createInvite,
  listInvites,
  revokeInvite,
} from '#/server/invites.functions'
import { requireRole } from '#/lib/guards'
import { createInviteSchema } from '#/lib/schemas'
import { inviteStatus } from '#/lib/invites'
import type { InviteStatus } from '#/lib/invites'
import { formatDateTime } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

/** Same audience as the queue — admins get in too, since admin implies operator. */
export const Route = createFileRoute('/_authed/invites')({
  beforeLoad: ({ context, location }) => {
    requireRole(context.user, 'operator', location.href)
  },
  loader: async () => ({ invites: await listInvites() }),
  component: InvitesPage,
})

function invitePath(token: string) {
  return `/signup?token=${token}`
}

const STATUS_BADGE: Record<InviteStatus, string> = {
  ACTIVE: 'border-sage-300 bg-sage-100 text-sage-800',
  USED: 'border-border bg-muted text-foreground',
  EXPIRED: 'border-border bg-muted text-muted-foreground',
  REVOKED: 'border-terracotta-300 bg-terracotta-100 text-crown',
}

const STATUS_LABEL: Record<InviteStatus, () => string> = {
  ACTIVE: m.invites_status_active,
  USED: m.invites_status_used,
  EXPIRED: m.invites_status_expired,
  REVOKED: m.invites_status_revoked,
}

function InvitesPage() {
  const { invites } = Route.useLoaderData()
  const router = useRouter()
  const create = useServerFn(createInvite)
  const revoke = useServerFn(revokeInvite)
  const [error, setError] = useState<string | null>(null)
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { expiresInHours: '24' },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const invite = await create({
          data: createInviteSchema.parse({
            expiresInHours: value.expiresInHours,
          }),
        })
        setJustCreatedToken(invite.token)
        await router.invalidate()
      } catch (e) {
        setError(e instanceof Error ? e.message : m.common_error_generic())
      }
    },
  })

  async function handleRevoke(id: string) {
    if (!confirm(m.invites_revoke_confirm())) return
    setError(null)
    try {
      await revoke({ data: { id } })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="min-w-0 text-3xl wrap-break-word hyphens-auto text-foreground">
        {m.invites_title()}
      </h1>

      <FormError>{error}</FormError>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-lg">{m.invites_create()}</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              setJustCreatedToken(null)
              void form.handleSubmit()
            }}
          >
            <form.Field name="expiresInHours">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.invites_expires_in_hours()}
                  className="w-40"
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    type="number"
                    min={1}
                    max={720}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.common_saving() : m.invites_create()}
                </Button>
              )}
            </form.Subscribe>
          </form>

          {justCreatedToken && <InviteLink token={justCreatedToken} />}
        </CardContent>
      </Card>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.invites_empty()}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* A phone gets one card per invite; the table is for wider screens. */}
          <ul className="grid gap-3 md:hidden">
            {invites.map((invite) => {
              const status = inviteStatus(invite)
              return (
                <li
                  key={invite.id}
                  className="grid min-w-0 gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn(STATUS_BADGE[status])}
                    >
                      {STATUS_LABEL[status]()}
                    </Badge>
                    {status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => void handleRevoke(invite.id)}
                      >
                        {m.invites_revoke()}
                      </Button>
                    )}
                  </div>
                  {status === 'ACTIVE' && (
                    <InviteLink token={invite.token} compact />
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <InviteFact label={m.invites_col_created_by()}>
                      {invite.createdBy.name}
                    </InviteFact>
                    <InviteFact label={m.invites_col_created()}>
                      {formatDateTime(invite.createdAt)}
                    </InviteFact>
                    <InviteFact label={m.invites_col_expires()}>
                      {formatDateTime(invite.expiresAt)}
                    </InviteFact>
                    <InviteFact label={m.invites_col_used_by()}>
                      {invite.usedBy?.name ?? m.common_none()}
                    </InviteFact>
                  </dl>
                </li>
              )
            })}
          </ul>

          {/* min-w-0: without it the table's width stretches the page instead
            of scrolling inside its own container. */}
          <Card className="hidden min-w-0 md:block">
            <CardContent className="px-0 py-2 sm:px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.invites_col_status()}</TableHead>
                    <TableHead>{m.invites_link()}</TableHead>
                    <TableHead>{m.invites_col_created_by()}</TableHead>
                    <TableHead>{m.invites_col_created()}</TableHead>
                    <TableHead>{m.invites_col_expires()}</TableHead>
                    <TableHead>{m.invites_col_used_by()}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => {
                    const status = inviteStatus(invite)
                    return (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(STATUS_BADGE[status])}
                          >
                            {STATUS_LABEL[status]()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {status === 'ACTIVE' ? (
                            <InviteLink token={invite.token} compact />
                          ) : (
                            <span className="text-muted-foreground">
                              {m.common_none()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{invite.createdBy.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(invite.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(invite.expiresAt)}
                        </TableCell>
                        <TableCell>
                          {invite.usedBy?.name ?? m.common_none()}
                        </TableCell>
                        <TableCell>
                          {status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void handleRevoke(invite.id)}
                            >
                              {m.invites_revoke()}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/** One labelled detail on an invite's phone card. */
function InviteFact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground">{children}</dd>
    </div>
  )
}

/** The shareable URL for one invite, with a click-to-copy button. */
function InviteLink({ token, compact }: { token: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const href =
    typeof window !== 'undefined'
      ? `${window.location.origin}${invitePath(token)}`
      : invitePath(token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied — the link is still selectable text.
    }
  }

  // The URL is one unbreakable word. Full size, it wraps anywhere (with the
  // copy button below it on a phone); compact, in a list, it is cut short.
  // Either way min-w-0, or the token's width pushes the whole page wide.
  return (
    <div
      className={cn(
        'flex min-w-0 gap-2',
        compact
          ? 'items-center'
          : 'flex-col items-start rounded-lg border border-border bg-surface-sunken px-3 py-2 sm:flex-row sm:items-center',
      )}
    >
      <code
        className={cn(
          'min-w-0 font-mono text-foreground',
          compact ? 'max-w-48 truncate text-xs' : 'text-sm break-all',
        )}
      >
        {href}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => void copy()}
      >
        {copied ? m.invites_copied() : m.invites_copy()}
      </Button>
    </div>
  )
}
