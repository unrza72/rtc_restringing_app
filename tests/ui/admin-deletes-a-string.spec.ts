import { expect, test } from '@playwright/test'

import {
  createApprovedUser,
  createClubString,
  createFinishedJob,
  createOpenRequest,
} from './fixtures'
import {
  PHONE,
  expectNoHorizontalOverflow,
  signIn,
  t,
  uniqueStamp,
} from './support'

test.use({ viewport: PHONE })

test('an admin deletes a used, deactivated string, but not one an open request waits for', async ({
  page,
}) => {
  const admin = await createApprovedUser('admin', 'Admin')
  const member = await createApprovedUser('member', 'Mitglied')
  const stamp = uniqueStamp()
  const retired = `Retired Poly ${stamp}`
  const wanted = `Wanted Gut ${stamp}`

  // Used once; the admin takes it off the request form below.
  await createClubString({ name: retired, priceCents: 1800 })
  const finished = await createFinishedJob(member, admin, {
    racket: 'Radical',
    clubString: retired,
    tensionMain: 23,
    labourPriceCents: 1500,
  })
  await createClubString({ name: wanted, priceCents: 2000 })
  await createOpenRequest(member, {
    racket: 'Speed',
    clubString: wanted,
    tensionMain: 24,
  })

  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/strings')
  const row = (name: string) =>
    page.getByRole('listitem').filter({ hasText: name })
  const dialog = page.getByRole('dialog')

  await test.step('A deactivated string is labelled as such', async () => {
    await row(retired)
      .getByRole('button', { name: t('racket_archive') })
      .click()
    await expect(row(retired)).toContainText(t('admin_string_inactive'))
    await expect(row(retired)).not.toContainText(t('member_status_REJECTED'))
  })

  await test.step('Deleting asks first, and cancelling keeps the string', async () => {
    await row(retired)
      .getByRole('button', { name: t('common_delete') })
      .click()
    await expect(dialog).toContainText(retired)
    await expectNoHorizontalOverflow(page)
    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await expect(dialog).toBeHidden()
    await expect(row(retired)).toBeVisible()
  })

  await test.step('A used, deactivated string is deleted for good', async () => {
    await row(retired)
      .getByRole('button', { name: t('common_delete') })
      .click()
    await dialog.getByRole('button', { name: t('common_delete') }).click()
    await expect(dialog).toBeHidden()
    await expect(row(retired)).toHaveCount(0)
  })

  await test.step('The finished job still names what was strung', async () => {
    await page.goto(`/queue/${finished.id}`)
    await expect(page.getByRole('main')).toContainText(`${retired} 1.25`)
    await page.goBack()
  })

  await test.step('A string an open request waits for is kept', async () => {
    await row(wanted)
      .getByRole('button', { name: t('common_delete') })
      .click()
    await dialog.getByRole('button', { name: t('common_delete') }).click()
    await expect(dialog.getByRole('alert')).toHaveText(
      t('admin_string_delete_open', { count: 1 }),
    )
    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await expect(row(wanted)).toBeVisible()
  })
})
