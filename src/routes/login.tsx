import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
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
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const search = Route.useSearch()
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
    </AuthShell>
  )
}
