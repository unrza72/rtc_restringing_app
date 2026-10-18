import { expect, test } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { euros, header, signIn, t, uniqueStamp } from './support'

test('an admin adds a string to the catalogue and then corrects it', async ({
  page,
}) => {
  const admin = await createApprovedUser('admin', 'Admin')
  const name = `Test Poly ${uniqueStamp()}`
  const renamed = `${name} Rough`

  await test.step('Admin adds a string', async () => {
    await signIn(page, admin.email, admin.password)
    await header(page)
      .getByRole('link', { name: t('nav_admin_strings') })
      .click()

    await page.getByLabel(t('admin_string_name'), { exact: true }).fill(name)
    await page.getByLabel(t('admin_string_gauge'), { exact: true }).fill('1.25')
    await page.getByLabel(t('admin_string_price'), { exact: true }).fill('18')
    await page.getByRole('button', { name: t('admin_string_add') }).click()

    await expect(
      page.getByRole('listitem').filter({ hasText: name }),
    ).toContainText(euros(18))
  })

  await test.step('The catalogue fits on a phone', async () => {
    await page.setViewportSize({ width: 360, height: 800 })
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      // The widest offenders, to say what broke rather than just that it did.
      const wide = [...document.querySelectorAll('main *')]
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName} ${el.textContent.trim().slice(0, 40)}`)
      return { scroll: document.documentElement.scrollWidth, width, wide }
    })
    expect(overflow.wide).toEqual([])
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.width)
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  await test.step('Admin edits its name and price in place', async () => {
    await page
      .getByRole('listitem')
      .filter({ hasText: name })
      .getByRole('button', { name: t('common_edit') })
      .click()

    // The row turns into the form, prefilled with what is there now. Its name
    // is an input value by then, not text, so find it by its Cancel button.
    const row = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: t('common_cancel') }),
    })
    const nameField = row.getByLabel(t('admin_string_name'), { exact: true })
    await expect(nameField).toHaveValue(name)
    const priceField = row.getByLabel(t('admin_string_price'), {
      exact: true,
    })
    await expect(priceField).toHaveValue('18.00')

    await nameField.fill(renamed)
    await priceField.fill('21.50')
    await row.getByRole('button', { name: t('common_save') }).click()

    const updated = page.getByRole('listitem').filter({ hasText: renamed })
    await expect(updated).toContainText(euros(21.5))
    await expect(
      updated.getByRole('button', { name: t('common_edit') }),
    ).toBeVisible()
  })
})
