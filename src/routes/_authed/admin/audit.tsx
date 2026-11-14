import { Link, createFileRoute } from '@tanstack/react-router'

import { listMemberAudit } from '#/server/members.functions'
import { parseRoles } from '#/lib/roles'
import type { Role } from '#/lib/roles'
import { formatDateTime, roleLabel } from '#/lib/labels'
import { m } from '#/paraglide/messages'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'

export const Route = createFileRoute('/_authed/admin/audit')({
  loader: async () => ({ entries: await listMemberAudit() }),
  component: AuditPage,
})

type Entry = Awaited<ReturnType<typeof listMemberAudit>>[number]

function AuditPage() {
  const { entries } = Route.useLoaderData()

  return (
    <div className="grid gap-6">
      <Link
        to="/admin/members"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {m.common_back()}
      </Link>

      <div className="grid gap-1">
        <h1 className="text-3xl wrap-break-word hyphens-auto text-foreground">
          {m.admin_audit_title()}
        </h1>
        <p className="text-sm text-muted-foreground">{m.admin_audit_intro()}</p>
      </div>

      <Card>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.admin_audit_empty()}
            </p>
          ) : (
            <ol className="divide-y" aria-label={m.admin_audit_title()}>
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AuditRow({ entry }: { entry: Entry }) {
  const before = entry.fromValue === null ? [] : parseRoles(entry.fromValue)
  const after = entry.toValue === null ? [] : parseRoles(entry.toValue)
  const showRoles = entry.action === 'ROLES_CHANGED'
  const added = after.filter((r) => !before.includes(r))
  const removed = before.filter((r) => !after.includes(r))

  return (
    <li className="grid gap-1.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="min-w-0 wrap-break-word">{describe(entry)}</p>
        <time
          dateTime={new Date(entry.createdAt).toISOString()}
          className="ml-auto text-xs whitespace-nowrap text-muted-foreground"
        >
          {formatDateTime(entry.createdAt)}
        </time>
      </div>
      <p className="text-xs break-all text-muted-foreground">
        {entry.targetEmail}
      </p>
      {showRoles && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <RoleChanges label={m.admin_audit_added()} roles={added} />
          <RoleChanges
            label={m.admin_audit_removed()}
            roles={removed}
            removed
          />
        </div>
      )}
    </li>
  )
}

function RoleChanges({
  label,
  roles,
  removed = false,
}: {
  label: string
  roles: Array<Role>
  removed?: boolean
}) {
  if (roles.length === 0) return null
  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      {roles.map((role) => (
        <Badge
          key={role}
          variant={removed ? 'outline' : 'secondary'}
          className={removed ? 'line-through' : undefined}
        >
          {roleLabel(role)}
        </Badge>
      ))}
    </>
  )
}

function describe(entry: Entry) {
  const actor = entry.actorName ?? '?'
  const target = entry.targetName
  switch (entry.action) {
    case 'APPROVED':
      return entry.fromValue === 'REJECTED'
        ? m.admin_audit_reapproved({ actor, target })
        : m.admin_audit_approved({ actor, target })
    case 'REJECTED':
      return m.admin_audit_rejected({ actor, target })
    case 'ROLES_CHANGED':
      return m.admin_audit_roles({ actor, target })
    case 'DELETED':
      return m.admin_audit_deleted({ actor, target })
    case 'ADMIN_SET':
      return entry.fromValue === null
        ? m.admin_audit_admin_created({ target })
        : m.admin_audit_admin_set({ target })
    default:
      return `${entry.action}: ${target}`
  }
}
