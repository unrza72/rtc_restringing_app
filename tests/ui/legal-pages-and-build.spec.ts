import { expect, test } from '@playwright/test'

import { ADMIN } from './env'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

const footer = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: t('footer_label') })

test('imprint and privacy notice are one click from every page, signed in or not', async ({
  page,
}) => {
  await test.step('A visitor finds both from the sign-in page', async () => {
    await page.goto('/login')
    for (const key of ['footer_imprint', 'footer_privacy'] as const) {
      await expect(
        footer(page).getByRole('link', { name: t(key) }),
      ).toBeVisible()
    }

    await footer(page)
      .getByRole('link', { name: t('footer_imprint') })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: t('legal_imprint_title') }),
    ).toBeVisible()
    await expect(
      page.getByRole('article').getByText('Royal Tennisclub Bezau'),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await footer(page)
      .getByRole('link', { name: t('footer_privacy') })
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: t('legal_privacy_title') }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Deine Rechte' }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  await test.step('The English pages say the German text applies', async () => {
    await page.goto('/en/privacy')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Privacy notice' }),
    ).toBeVisible()
    await expect(page.getByText('the German version applies')).toBeVisible()
  })

  await test.step('A signed-in admin sees the footer too, and the build on the strings page', async () => {
    await signIn(page, ADMIN.email, ADMIN.password)
    await page.goto('/admin/strings')
    const imprint = footer(page).getByRole('link', {
      name: t('footer_imprint'),
    })
    await imprint.scrollIntoViewIfNeeded()
    await expect(imprint).toBeInViewport({ ratio: 1 })

    // A real hash (7 hex characters, maybe "-dirty"), not the "unknown"
    // fallback: the test server runs a production build.
    const version = page.getByText(t('admin_build_commit'), { exact: false })
    await expect(version).toContainText(/\b[0-9a-f]{7}(-dirty)?\b/)
    await expectNoHorizontalOverflow(page)
  })
})
