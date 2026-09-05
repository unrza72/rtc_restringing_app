import type { ReactNode } from 'react'

import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

/**
 * Presentational field wrapper. Kept free of TanStack Form generics so it works
 * for form fields and plain inputs alike; `fieldErrors` normalises the messages.
 */
export function Field({
  id,
  label,
  hint,
  errors = [],
  className,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  errors?: Array<string>
  className?: string
  children: ReactNode
}) {
  const error = errors[0]
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** TanStack Form surfaces Standard Schema issues; we only render the message. */
export function fieldErrors(meta: {
  isTouched: boolean
  errors: Array<unknown>
}): Array<string> {
  if (!meta.isTouched) return []
  return meta.errors
    .map((e) =>
      typeof e === 'string'
        ? e
        : e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : null,
    )
    .filter((e): e is string => !!e)
}

/** Server errors that are not tied to one field. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  )
}
