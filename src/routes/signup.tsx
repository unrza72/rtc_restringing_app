import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FormError, fieldErrors } from '#/components/form-field'

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/, m.auth_username_hint()),
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

  const form = useForm({
    defaultValues: { name: '', username: '', email: '', password: '' },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.signUp.email({
        name: value.name.trim(),
        username: value.username.trim(),
        email: value.email.trim(),
        password: value.password,
      })
      if (error) {
        // better-auth reports these as distinct codes; both are worth naming.
        const code = error.code ?? ''
        setFormError(
          code.includes('USERNAME')
            ? m.auth_username_taken()
            : code.includes('EMAIL')
              ? m.auth_email_taken()
              : (error.message ?? m.common_error_generic()),
        )
        return
      }
      // New accounts start as PENDING — the guard routes them to /pending.
      await router.invalidate()
      await router.navigate({ to: '/pending' })
    },
  })

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{m.auth_sign_up_title()}</CardTitle>
          <CardDescription>{m.auth_sign_up_subtitle()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
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

            <form.Field name="username">
              {(field) => (
                <Field
                  id={field.name}
                  label={m.auth_username()}
                  hint={m.auth_username_hint()}
                  errors={fieldErrors(field.state.meta)}
                >
                  <Input
                    id={field.name}
                    autoComplete="username"
                    autoCapitalize="none"
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? m.common_loading() : m.auth_sign_up_action()}
                </Button>
              )}
            </form.Subscribe>

            <Link
              to="/login"
              search={{ redirect: undefined }}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {m.auth_to_sign_in()}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
