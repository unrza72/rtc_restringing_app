import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { History, Trash2 } from 'lucide-react'

import {
  decideMember,
  deleteMember,
  listMembers,
  setMemberRoles,
} from '#/server/members.functions'
import { ROLES } from '#/lib/roles'
import type { Role } from '#/lib/roles'
import { formatDate, roleLabel, userStatusLabel } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { FormError } from '#/components/form-field'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/admin/members')({
  loader: async () => ({ members: await listMembers() }),
  component: MembersPage,
})

function MembersPage() {
  const { members } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const decide = useServerFn(decideMember)
  const updateRoles = useServerFn(setMemberRoles)
  const remove = useServerFn(deleteMember)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    }
  }

  const pending = members.filter((mem) => mem.status === 'PENDING')
  const rest = members.filter((mem) => mem.status !== 'PENDING')

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-3xl text-foreground">{m.admin_members_title()}</h1>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/admin/audit">
            <History aria-hidden />
            {m.admin_audit_title()}
          </Link>
        </Button>
      </div>

      <FormError>{error}</FormError>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{m.admin_members_pending()}</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.admin_no_pending()}
            </p>
          ) : (
            <ul className="divide-y">
              {pending.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium wrap-break-word">{member.name}</p>
                    <p className="text-xs break-all text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void run(() =>
                          decide({
                            data: { userId: member.id, status: 'APPROVED' },
                          }),
                        )
                      }
                    >
                      {m.admin_approve()}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        void run(() =>
                          decide({
                            data: { userId: member.id, status: 'REJECTED' },
                          }),
                        )
                      }
                    >
                      {m.admin_reject()}
                    </Button>
                    <DeleteButton
                      onClick={() => setConfirm({ kind: 'delete', member })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{m.admin_members_all()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rest.map((member) => (
              <li key={member.id} className="grid gap-2 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 font-medium wrap-break-word">
                    {member.name}
                  </span>
                  <span className="min-w-0 text-xs break-all text-muted-foreground">
                    {member.email}
                  </span>
                  <Badge
                    variant={
                      member.status === 'APPROVED' ? 'secondary' : 'destructive'
                    }
                  >
                    {userStatusLabel(member.status ?? 'PENDING')}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {m.admin_member_since({
                      date: formatDate(member.createdAt),
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {m.admin_roles()}:
                  </span>
                  {ROLES.map((role) => (
                    <RoleToggle
                      key={role}
                      role={role}
                      active={member.roles.includes(role)}
                      // "member" is implied by every other role, and nobody
                      // should be able to strip their own admin rights.
                      disabled={
                        role === 'member' ||
                        (member.id === user.id && role === 'admin')
                      }
                      onToggle={() =>
                        void run(() =>
                          updateRoles({
                            data: {
                              userId: member.id,
                              roles: toggleRole(member.roles, role),
                            },
                          }),
                        )
                      }
                    />
                  ))}

                  {member.id !== user.id && (
                    <div className="ml-auto flex flex-wrap gap-2">
                      {member.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            void run(() =>
                              decide({
                                data: { userId: member.id, status: 'REJECTED' },
                              }),
                            )
                          }
                        >
                          {m.admin_reject()}
                        </Button>
                      )}
                      {member.status === 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirm({ kind: 'reapprove', member })
                          }
                        >
                          {m.admin_reapprove()}
                        </Button>
                      )}
                      <DeleteButton
                        onClick={() => setConfirm({ kind: 'delete', member })}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmation={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async ({ kind, member }) => {
          if (kind === 'delete') {
            await remove({ data: { userId: member.id } })
          } else {
            await decide({ data: { userId: member.id, status: 'APPROVED' } })
          }
          await router.invalidate()
        }}
      />
    </div>
  )
}

type Confirmation = {
  kind: 'reapprove' | 'delete'
  member: { id: string; name: string }
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      title={m.admin_delete()}
      onClick={onClick}
    >
      <Trash2 aria-hidden />
      <span className="sr-only sm:not-sr-only">{m.admin_delete()}</span>
    </Button>
  )
}

/**
 * Asks before re-approving or deleting a member. Stays open on failure and
 * shows the server's reason (e.g. a member with billing history), since that
 * is where the admin is looking.
 */
function ConfirmDialog({
  confirmation,
  onClose,
  onConfirm,
}: {
  confirmation: Confirmation | null
  onClose: () => void
  onConfirm: (confirmation: Confirmation) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Keep the last content while the dialog animates out.
  const [shown, setShown] = useState(confirmation)
  if (confirmation && confirmation !== shown) {
    setShown(confirmation)
    setError(null)
  }

  async function confirm() {
    if (!shown) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(shown)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error_generic())
    } finally {
      setBusy(false)
    }
  }

  const isDelete = shown?.kind === 'delete'
  const name = shown?.member.name ?? ''

  return (
    <Dialog
      open={confirmation !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-break-word">
            {isDelete
              ? m.admin_delete_title({ name })
              : m.admin_reapprove_title({ name })}
          </DialogTitle>
          <DialogDescription>
            {isDelete
              ? m.admin_delete_body()
              : m.admin_reapprove_body({ name })}
          </DialogDescription>
        </DialogHeader>
        <FormError>{error}</FormError>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            {m.common_cancel()}
          </Button>
          <Button
            type="button"
            variant={isDelete ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {isDelete
              ? busy
                ? m.admin_deleting()
                : m.admin_delete()
              : m.admin_reapprove()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toggleRole(roles: Array<Role>, role: Role): Array<Role> {
  const next = roles.includes(role)
    ? roles.filter((r) => r !== role)
    : [...roles, role]
  return next.length === 0 ? ['member'] : next
}

function RoleToggle({
  role,
  active,
  disabled,
  onToggle,
}: {
  role: Role
  active: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-accent',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {roleLabel(role)}
    </button>
  )
}
