import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import { recordInitialLocale } from '#/server/locale.functions'
import { checkInvite } from '#/server/invites.functions'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import { AuthShell } from '#/components/auth-shell'

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8),
})

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({ token: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/dashboard' })
  },
  // A pre-flight check, purely for UX: shows "this link is no longer valid"
  // without making someone fill in the whole form first. The actual gate is
  // server-side in auth.ts's validateUserInfo — this can't be trusted as the
  // boundary, since it's a plain GET a visitor could just not call.
  loaderDeps: ({ search }) => ({ token: search.token ?? null }),
  loader: async ({ deps }) => ({
    invite: await checkInvite({ data: { token: deps.token } }),
  }),
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  const search = Route.useSearch()
  const { invite } = Route.useLoaderData()
  const [formError, setFormError] = useState<string | null>(null)
  const recordLocale = useServerFn(recordInitialLocale)

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.signUp.email({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        inviteToken: search.token,
      })
      if (error) {
        setFormError(
          error.code?.includes('EMAIL')
            ? m.auth_email_taken()
            : error.code?.includes('invite')
              ? m.auth_invite_invalid()
              : (error.message ?? m.common_error_generic()),
        )
        return
      }
      // Records today's ambient locale as this brand-new account's starting
      // preference, so it carries over even if they never touch the toggle.
      await recordLocale({ data: { locale: getLocale() } })
      // New accounts start as PENDING — the guard routes them to /pending.
      await router.invalidate()
      await router.navigate({ to: '/pending' })
    },
  })

  if (!invite.valid) {
    return (
      <AuthShell title={m.app_name()} subtitle={m.auth_invite_invalid_title()}>
        <div className="grid gap-4 p-6">
          <p className="text-sm text-slate-400">
            {m.auth_invite_invalid_body()}
          </p>
          <Link
            to="/login"
            search={{ redirect: undefined }}
            className="text-sm font-semibold text-lime-400 hover:text-lime-300"
          >
            {m.auth_to_sign_in()}
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={m.app_name()} subtitle={m.auth_sign_up_subtitle()}>
      <form
        className="grid gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormError>{formError}</FormError>

        <form.Field name="name">
          {(field) => (
            <Field
              id={field.name}
              label={m.auth_name()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                autoComplete="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field
              id={field.name}
              label={m.auth_email()}
              hint={m.auth_email_hint()}
              errors={fieldErrors(field.state.meta)}
            >
              <Input
                id={field.name}
                type="email"
                autoComplete="email"
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
                type="password"
                autoComplete="new-password"
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
              {isSubmitting ? m.common_loading() : m.auth_sign_up_action()}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthShell>
  )
}
