import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

import {
  decideMember,
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
  const [error, setError] = useState<string | null>(null)

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
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        {m.admin_members_title()}
      </h1>

      <FormError>{error}</FormError>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {m.admin_members_pending()}
          </CardTitle>
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
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.displayUsername ?? member.username} ·{' '}
                      {member.email}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.admin_members_all()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rest.map((member) => (
              <li key={member.id} className="grid gap-2 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.displayUsername ?? member.username}
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

                  {member.status === 'APPROVED' && member.id !== user.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive hover:text-destructive"
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
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
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
