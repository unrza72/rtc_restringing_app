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
  ACTIVE: 'border-emerald-500 bg-emerald-950 text-emerald-200',
  USED: 'border-slate-700 bg-slate-800 text-slate-300',
  EXPIRED: 'border-slate-700 bg-slate-800/60 text-slate-500',
  REVOKED: 'border-rose-800 bg-rose-950 text-rose-300',
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
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        {m.invites_title()}
      </h1>

      <FormError>{error}</FormError>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.invites_create()}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
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
        <Card>
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
                          <span className="text-slate-600">
                            {m.common_none()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{invite.createdBy.name}</TableCell>
                      <TableCell className="text-slate-400">
                        {formatDateTime(invite.createdAt)}
                      </TableCell>
                      <TableCell className="text-slate-400">
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
      )}
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

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        !compact && 'rounded-lg border border-slate-800 bg-slate-950 px-3 py-2',
      )}
    >
      <code
        className={cn(
          'truncate font-mono text-slate-300',
          compact ? 'max-w-48 text-xs' : 'text-sm',
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
