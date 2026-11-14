import { expect, test } from '@playwright/test'

import {
  createApprovedUser,
  createOpenRequest,
  rejectUser,
  userExists,
} from './fixtures'
import { ADMIN } from './env'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('an admin approves a rejected member again and deletes an account, confirming each', async ({
  page,
}) => {
  const comeback = await createApprovedUser('member', 'Rückkehrer')
  const spam = await createApprovedUser('member', 'Spam')
  const regular = await createApprovedUser('member', 'Stammkunde')
  await rejectUser(comeback)
  await rejectUser(spam)
  await createOpenRequest(regular, {
    racket: 'Blade 98',
    clubString: 'Head Velocity MLT',
    tensionMain: 23,
  })

  await signIn(page, ADMIN.email, ADMIN.password)
  await page.goto('/admin/members')
  const row = (name: string) =>
    page.getByRole('listitem').filter({ hasText: name })
  const dialog = page.getByRole('dialog')

  await test.step('A rejected member can be approved again, after confirming', async () => {
    const reapprove = row(comeback.name).getByRole('button', {
      name: t('admin_reapprove'),
    })
    await reapprove.scrollIntoViewIfNeeded()
    await expect(reapprove).toBeInViewport({ ratio: 1 })
    await expectNoHorizontalOverflow(page)

    // Cancelling leaves them rejected.
    await reapprove.click()
    await expect(dialog).toContainText(comeback.name)
    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await expect(dialog).toBeHidden()
    await expect(row(comeback.name)).toContainText(t('member_status_REJECTED'))

    await reapprove.click()
    await dialog.getByRole('button', { name: t('admin_reapprove') }).click()
    await expect(dialog).toBeHidden()
    await expect(row(comeback.name)).toContainText(t('member_status_APPROVED'))
  })

  await test.step('An account without history is deleted for good', async () => {
    const remove = row(spam.name).getByRole('button', {
      name: t('admin_delete'),
    })
    await remove.scrollIntoViewIfNeeded()
    await expect(remove).toBeInViewport({ ratio: 1 })
    await remove.click()
    await expect(dialog).toContainText(spam.name)
    await expectNoHorizontalOverflow(page)
    await dialog.getByRole('button', { name: t('admin_delete') }).click()
    await expect(dialog).toBeHidden()
    await expect(row(spam.name)).toHaveCount(0)
    expect(await userExists(spam)).toBe(false)
  })

  await test.step('A member with requests on record is kept', async () => {
    await row(regular.name)
      .getByRole('button', { name: t('admin_delete') })
      .click()
    await dialog.getByRole('button', { name: t('admin_delete') }).click()
    await expect(dialog.getByRole('alert')).toHaveText(
      t('admin_delete_has_history'),
    )
    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await expect(row(regular.name)).toBeVisible()
    expect(await userExists(regular)).toBe(true)
  })
})
