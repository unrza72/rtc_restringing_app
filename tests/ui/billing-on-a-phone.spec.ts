import { expect, test } from '@playwright/test'

import { createApprovedUser, createFinishedJob } from './fixtures'
import { PHONE, euros, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('a controller settles a job on a phone without scrolling sideways', async ({
  page,
}) => {
  const accountant = await createApprovedUser('controller', 'Kassenwart')
  const stringer = await createApprovedUser('operator', 'Besaiter')
  const member = await createApprovedUser('member', 'Mitglied')
  // Head Velocity MLT costs 19,00 € in the test catalogue: 34,00 € in all.
  await createFinishedJob(member, stringer, {
    racket: 'Speed MP',
    clubString: 'Head Velocity MLT',
    tensionMain: 23,
    labourPriceCents: 1500,
  })

  // On a phone each job is a list item rather than a table row.
  const job = page.getByRole('listitem').filter({ hasText: member.name })

  await test.step('The billing overview fits the screen', async () => {
    await signIn(page, accountant.email, accountant.password)
    await page.goto('/billing')
    await expect(
      page.getByRole('heading', { name: t('billing_title') }),
    ).toBeVisible()
    await page
      .getByPlaceholder(t('billing_search_placeholder'))
      .fill(member.name)
    await expectNoHorizontalOverflow(page)
  })

  await test.step('A job shows its price parts and total', async () => {
    await expect(job).toHaveCount(1)
    await expect(job).toContainText('Speed MP')
    await expect(job).toContainText(stringer.name)
    await expect(job).toContainText(euros(19))
    await expect(job).toContainText(euros(15))
    await expect(job).toContainText(euros(34))
    await expect(job).toContainText(t('billing_unpaid'))
  })

  await test.step('The controller marks it paid from the card', async () => {
    const markPaid = job.getByRole('button', { name: t('billing_mark_paid') })
    await expect(markPaid).toBeInViewport({ ratio: 1 })
    await markPaid.click()
    await expect(
      job.getByRole('button', { name: t('billing_mark_unpaid') }),
    ).toBeVisible()
    await expect(job).not.toContainText(t('billing_unpaid'))
    await expectNoHorizontalOverflow(page)
  })

  await test.step('The payouts page fits too', async () => {
    await page.goto('/billing/payouts')
    await expect(
      page.getByRole('heading', { name: t('payouts_title') }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  await test.step('The stringer is paid out from their card', async () => {
    const balance = page
      .getByRole('listitem')
      .filter({ hasText: stringer.name })
      .filter({
        has: page.getByRole('button', { name: t('payouts_reimburse') }),
      })
    await expect(balance).toContainText(euros(15))
    await balance.getByRole('button', { name: t('payouts_reimburse') }).click()

    const dialog = page.getByRole('dialog', {
      name: t('payouts_reimburse_title', { name: stringer.name }),
    })
    await dialog.getByLabel(t('payouts_amount'), { exact: true }).fill('15')
    await dialog
      .getByLabel(t('payouts_note'), { exact: true })
      .fill('Bar beim Training')
    await expectNoHorizontalOverflow(page)
    await dialog.getByRole('button', { name: t('payouts_reimburse') }).click()
    await expect(dialog).toBeHidden()

    // The payout history, one entry per line on a phone.
    const entry = page
      .getByRole('listitem')
      .filter({ hasText: 'Bar beim Training' })
      .filter({ hasText: stringer.name })
    await expect(entry).toContainText(euros(15))
    await expect(entry).toContainText(accountant.name)
    await expectNoHorizontalOverflow(page)
  })
})
