import { expect, test } from '@playwright/test'

import { paymentReference } from '../../src/lib/payment'
import {
  createApprovedUser,
  createClubString,
  createFinishedJob,
} from './fixtures'
import { ADMIN } from './env'
import {
  PHONE,
  euros,
  expectNoHorizontalOverflow,
  signIn,
  t,
  uniqueStamp,
} from './support'

test.use({ viewport: PHONE })

const IBAN = 'AT611904300234573201'

test('a member pays a finished job from its QR code, and the details disappear once paid', async ({
  page,
  browser,
}) => {
  const member = await createApprovedUser('member', 'Zahler')
  const stringer = await createApprovedUser('operator', 'Besaiter')
  const string = `QR Poly ${uniqueStamp()}`
  await createClubString({ name: string, priceCents: 1800 })
  const job = await createFinishedJob(member, stringer, {
    racket: 'Pure Aero',
    clubString: string,
    tensionMain: 24,
    labourPriceCents: 1500,
  })
  const reference = paymentReference(job.id, member.name)

  const paymentCard = (on: typeof page) =>
    on
      .locator('[data-slot="card"]')
      .filter({ has: on.getByText(t('payment_title'), { exact: true }) })

  await signIn(page, ADMIN.email, ADMIN.password)

  await test.step('The admin enters the bank account; a mistyped IBAN is refused', async () => {
    await page.goto('/admin/strings')
    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: t('admin_payment_title') })
    await card.getByLabel(t('admin_payment_recipient')).fill('Tennisclub RTC')
    await card
      .getByLabel(t('admin_payment_iban'))
      .fill('AT62 1904 3002 3457 3201')
    await card.getByRole('button', { name: t('common_save') }).click()
    await expect(card.getByRole('alert')).toHaveText(
      t('admin_payment_iban_invalid'),
    )

    await card
      .getByLabel(t('admin_payment_iban'))
      .fill('at61 1904 3002 3457 3201')
    await card.getByRole('button', { name: t('common_save') }).click()
    await expect(card.getByRole('status')).toHaveText(
      t('admin_token_count_saved'),
    )
    // Saved normalized, shown grouped.
    await expect(card.getByLabel(t('admin_payment_iban'))).toHaveValue(
      'AT61 1904 3002 3457 3201',
    )
    await expectNoHorizontalOverflow(page)
  })

  const memberContext = await browser.newContext({
    viewport: PHONE,
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const memberPage = await memberContext.newPage()
  await signIn(memberPage, member.email, member.password)

  await test.step('The member sees the QR code and every detail to copy', async () => {
    await memberPage.goto(`/requests/${job.id}`)
    const card = paymentCard(memberPage)
    await expect(card).toBeVisible()
    await expect(card).toContainText('Tennisclub RTC')
    await expect(card).toContainText('AT61 1904 3002 3457 3201')
    await expect(card).toContainText(euros(33))
    await expect(card).toContainText(reference)
    await expect(
      card.getByRole('img', {
        name: t('payment_qr_label', { amount: '' }).trim(),
      }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(memberPage)

    const copyIban = card.getByRole('button', {
      name: t('payment_copy', { field: t('payment_iban') }),
    })
    await copyIban.scrollIntoViewIfNeeded()
    await expect(copyIban).toBeInViewport({ ratio: 1 })
    await copyIban.click()
    await expect(
      card.getByRole('button', { name: t('payment_copied') }),
    ).toBeVisible()
    expect(
      await memberPage.evaluate(() => navigator.clipboard.readText()),
    ).toBe(IBAN)

    await card
      .getByRole('button', {
        name: t('payment_copy', { field: t('payment_amount') }),
      })
      .click()
    expect(
      await memberPage.evaluate(() => navigator.clipboard.readText()),
    ).toBe('33,00')
  })

  await test.step('At handover, the stringer shows the same code', async () => {
    await page.goto(`/queue/${job.id}`)
    const card = paymentCard(page)
    await expect(card).toContainText(
      t('payment_intro_operator', { name: member.name }),
    )
    await expect(card).toContainText(reference)
  })

  await test.step('The reference from the bank statement finds the job, which is marked paid', async () => {
    await page.goto('/billing')
    await page
      .getByPlaceholder(t('billing_search_placeholder'))
      .fill(`Gutschrift ${reference.toLowerCase()}`)
    const rows = page.getByRole('listitem').filter({ hasText: member.name })
    await expect(rows).toHaveCount(1)
    await rows.getByRole('button', { name: t('billing_mark_paid') }).click()
    await expect(
      rows.getByRole('button', { name: t('billing_mark_unpaid') }),
    ).toBeVisible()
  })

  await test.step('Once paid, the member no longer sees payment details', async () => {
    await memberPage.reload()
    await expect(memberPage.getByText(t('billing_paid'))).toBeVisible()
    await expect(paymentCard(memberPage)).toHaveCount(0)
  })

  await test.step('Without a bank account, no payment details are shown', async () => {
    const unpaid = await createFinishedJob(member, stringer, {
      racket: 'Pure Drive',
      clubString: string,
      tensionMain: 24,
      labourPriceCents: 1500,
    })
    await memberPage.goto(`/requests/${unpaid.id}`)
    await expect(paymentCard(memberPage)).toBeVisible()

    await page.goto('/admin/strings')
    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: t('admin_payment_title') })
    await card.getByLabel(t('admin_payment_recipient')).fill('')
    await card.getByLabel(t('admin_payment_iban')).fill('')
    await card.getByRole('button', { name: t('common_save') }).click()
    await expect(card.getByRole('status')).toBeVisible()

    await memberPage.reload()
    await expect(memberPage.getByText(t('billing_unpaid'))).toBeVisible()
    await expect(paymentCard(memberPage)).toHaveCount(0)
  })

  await memberContext.close()
})
