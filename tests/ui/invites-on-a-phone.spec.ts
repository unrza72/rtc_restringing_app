import { expect, test } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('a stringer creates an invite link on a phone without scrolling sideways', async ({
  page,
}) => {
  const operator = await createApprovedUser('operator', 'Besaiter')

  await test.step('The fresh invite link fits, copy button included', async () => {
    await signIn(page, operator.email, operator.password)
    await page.goto('/invites')
    await page.getByRole('button', { name: t('invites_create') }).click()

    // The whole link is shown, wrapped — the token is what the member needs.
    const link = page.locator('code').filter({ hasText: '/signup?token=' })
    await expect(link.first()).toBeVisible()
    await expect(link.first()).toBeInViewport({ ratio: 1 })
    await expect(
      page.getByRole('button', { name: t('invites_copy') }).first(),
    ).toBeInViewport({ ratio: 1 })
    await expectNoHorizontalOverflow(page)
  })

  await test.step('The invite list fits as well', async () => {
    const invite = page
      .getByRole('listitem')
      .filter({ hasText: operator.name })
      .filter({ hasText: t('invites_status_active') })
    await expect(invite.first()).toBeVisible()
    await expect(
      invite.first().getByRole('button', { name: t('invites_revoke') }),
    ).toBeInViewport({ ratio: 1 })
    await expectNoHorizontalOverflow(page)
  })
})
