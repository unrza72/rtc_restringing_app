import { expect, test } from '@playwright/test'

import { PHONE, t } from './support'

test.use({ viewport: PHONE })

// The test server runs without better-auth's rate limiter (it's on only in
// production), so the 429 it would send is played back here instead.
test('a rate-limited sign-in says to wait, not that the password is wrong', async ({
  page,
}) => {
  await page.route('**/api/auth/sign-in/email', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'X-Retry-After': '42' },
      body: JSON.stringify({
        message: 'Too many requests. Please try again later.',
      }),
    }),
  )

  await page.goto('/login')
  await page.getByLabel(t('auth_email')).fill('someone@example.com')
  await page.getByLabel(t('auth_password')).fill('whatever-password')
  await page.getByRole('button', { name: t('auth_sign_in_action') }).click()

  await expect(page.getByText(t('auth_rate_limited'))).toBeVisible()
  await expect(page.getByText(t('auth_invalid_credentials'))).toHaveCount(0)
  await expect(page).toHaveURL(/\/login/)
})
