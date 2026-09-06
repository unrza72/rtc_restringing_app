import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import { recordInitialLocale } from '#/server/locale.functions'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field, FormError, fieldErrors } from '#/components/form-field'
import { AuthShell, AuthTabs } from '#/components/auth-shell'

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8),
})

export const Route = createFileRoute('/signup')({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/dashboard' })
  },
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
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
      })
      if (error) {
        setFormError(
          error.code?.includes('EMAIL')
            ? m.auth_email_taken()
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

  return (
    <AuthShell title={m.app_name()} subtitle={m.auth_sign_up_subtitle()}>
      <AuthTabs active="signup" />
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
