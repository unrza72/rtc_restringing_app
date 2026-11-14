import { expect, test } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { ADMIN } from './env'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('every rejection, approval, role change and deletion lands in the audit log', async ({
  page,
}) => {
  const member = await createApprovedUser('member', 'Protokolliert')

  await signIn(page, ADMIN.email, ADMIN.password)
  await page.goto('/admin/members')
  const row = page.getByRole('listitem').filter({ hasText: member.name })
  const dialog = page.getByRole('dialog')

  await test.step('The admin rejects, re-approves, makes a stringer and deletes', async () => {
    await row.getByRole('button', { name: t('admin_reject') }).click()
    await expect(row).toContainText(t('member_status_REJECTED'))

    await row.getByRole('button', { name: t('admin_reapprove') }).click()
    await dialog.getByRole('button', { name: t('admin_reapprove') }).click()
    await expect(row).toContainText(t('member_status_APPROVED'))

    const stringer = row.getByRole('button', { name: t('role_operator') })
    await stringer.click()
    await expect(stringer).toHaveAttribute('aria-pressed', 'true')

    await row.getByRole('button', { name: t('admin_delete') }).click()
    await dialog.getByRole('button', { name: t('admin_delete') }).click()
    await expect(row).toHaveCount(0)
  })

  await test.step('The log lists all four, newest first, after the account is gone', async () => {
    await page.getByRole('link', { name: t('admin_audit_title') }).click()
    await expect(
      page.getByRole('heading', { name: t('admin_audit_title') }),
    ).toBeVisible()

    const entries = page
      .getByRole('list', { name: t('admin_audit_title') })
      .getByRole('listitem')
      .filter({ hasText: member.email })
    const params = { actor: ADMIN.name, target: member.name }
    await expect(entries).toHaveCount(4)
    await expect(entries.nth(0)).toContainText(t('admin_audit_deleted', params))
    await expect(entries.nth(1)).toContainText(t('admin_audit_roles', params))
    await expect(entries.nth(1)).toContainText(
      `${t('admin_audit_added')}:${t('role_operator')}`,
    )
    await expect(entries.nth(2)).toContainText(
      t('admin_audit_reapproved', params),
    )
    await expect(entries.nth(3)).toContainText(
      t('admin_audit_rejected', params),
    )

    await expectNoHorizontalOverflow(page)
  })
})
