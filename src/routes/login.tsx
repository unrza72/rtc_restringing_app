import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import {
  getDevQuickLoginUsers,
  devQuickSignIn,
} from '#/server/dev-login.functions'
import { roleLabel } from '#/lib/labels'
import type { DevLoginSlot } from '#/lib/dev-quick-login'
import type { Role } from '#/lib/roles'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import { AuthShell, AuthTabs } from '#/components/auth-shell'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ to: search.redirect ?? '/dashboard' })
    }
  },
  // Empty unless DEV_QUICK_LOGIN_ENABLED=true, so this costs nothing in a
  // real deployment beyond one extra request that always resolves to [].
  loader: async () => ({ devUsers: await getDevQuickLoginUsers() }),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const search = Route.useSearch()
  const { devUsers } = Route.useLoaderData()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onSubmit: z.object({
        email: z.email(),
        password: z.string().min(1),
      }),
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
      })
      if (error) {
        setFormError(m.auth_invalid_credentials())
        return
      }
      // Re-run the root beforeLoad so the nav and guards see the new session.
      await router.invalidate()
      await router.navigate({ to: search.redirect ?? '/dashboard' })
    },
  })

  return (
    <AuthShell title={m.app_name()} subtitle={m.auth_sign_in_subtitle()}>
      <AuthTabs active="login" />
      <form
        className="grid gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormError>{formError}</FormError>

        <form.Field name="email">
          {(field) => (
            <Field
              id={field.name}
              label={m.auth_email()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <Field
              id={field.name}
              label={m.auth_password()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting} className="font-bold">
              {isSubmitting ? m.common_loading() : m.auth_sign_in_action()}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {devUsers.length > 0 && (
        <DevQuickLogin
          users={devUsers}
          redirectTo={search.redirect}
          onError={setFormError}
        />
      )}
    </AuthShell>
  )
}

/**
 * Spike devtools — only rendered when the server says the roster is
 * non-empty, i.e. DEV_QUICK_LOGIN_ENABLED=true. See dev-login.functions.ts.
 */
function DevQuickLogin({
  users,
  redirectTo,
  onError,
}: {
  users: Array<{ slot: DevLoginSlot; name: string; role: Role }>
  redirectTo: string | undefined
  onError: (message: string) => void
}) {
  const router = useRouter()
  const quickSignIn = useServerFn(devQuickSignIn)
  const [pendingSlot, setPendingSlot] = useState<DevLoginSlot | null>(null)

  async function handleClick(slot: DevLoginSlot) {
    onError('')
    setPendingSlot(slot)
    try {
      await quickSignIn({ data: { slot } })
      await router.invalidate()
      await router.navigate({ to: redirectTo ?? '/dashboard' })
    } catch (error) {
      onError(error instanceof Error ? error.message : m.common_error_generic())
    } finally {
      setPendingSlot(null)
    }
  }

  return (
    <div className="border-t border-slate-800 p-6">
      <p className="mb-3 text-[11px] font-bold tracking-wider text-amber-400 uppercase">
        {m.devlogin_title()}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {users.map((user) => (
          <button
            key={user.slot}
            type="button"
            disabled={pendingSlot !== null}
            onClick={() => void handleClick(user.slot)}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left text-sm transition-colors hover:border-slate-700 hover:bg-slate-800 disabled:opacity-50"
          >
            <span className="font-medium text-slate-200">{user.name}</span>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {pendingSlot === user.slot
                ? m.common_loading()
                : roleLabel(user.role)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
