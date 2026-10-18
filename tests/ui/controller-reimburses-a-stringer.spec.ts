import { expect, test } from '@playwright/test'

import { createApprovedUser, createFinishedJob } from './fixtures'
import { euros, header, signIn, t } from './support'

test('a controller settles a job and pays the stringer out of their labour', async ({
  page: controller,
}) => {
  const accountant = await createApprovedUser('controller', 'Kassenwart')
  const stringer = await createApprovedUser('operator', 'Besaiter')
  const member = await createApprovedUser('member', 'Mitglied')
  // Head Velocity MLT costs 19,00 € in the test catalogue: 34,00 € in all.
  await createFinishedJob(member, stringer, {
    racket: 'Blade 98',
    clubString: 'Head Velocity MLT',
    tensionMain: 23,
    labourPriceCents: 1500,
  })
  const payoutNote = 'Bar ausgezahlt beim Clubabend'

  // The payouts page holds two tables: balances on top, the ledger below.
  const balances = controller.getByRole('table').filter({
    has: controller.getByRole('columnheader', { name: t('payouts_earned') }),
  })
  const ledger = controller.getByRole('table').filter({
    has: controller.getByRole('columnheader', {
      name: t('payouts_recorded_by'),
    }),
  })
  const stringerBalance = balances
    .getByRole('row')
    .filter({ hasText: stringer.name })

  /** Earned, paid out and still open — the three money columns of a balance. */
  async function expectBalance(earned: number, paid: number, open: number) {
    const cells = stringerBalance.getByRole('cell')
    await expect(cells.nth(1)).toHaveText(euros(earned))
    await expect(cells.nth(2)).toHaveText(euros(paid))
    await expect(cells.nth(3)).toHaveText(euros(open))
  }

  await test.step('Controller signs in — nothing is owed to the stringer yet', async () => {
    await signIn(controller, accountant.email, accountant.password)
    await header(controller)
      .getByRole('link', { name: t('nav_payouts') })
      .click()
    await expect(
      controller.getByRole('heading', { name: t('payouts_title') }),
    ).toBeVisible()
    // The job is done but the member hasn't paid, so its labour isn't owed.
    await expect(controller.getByText(stringer.name)).toHaveCount(0)
  })

  await test.step('Controller marks the member’s job as paid', async () => {
    await header(controller)
      .getByRole('link', { name: t('nav_billing') })
      .click()
    await expect(
      controller.getByRole('heading', { name: t('billing_title') }),
    ).toBeVisible()

    await controller
      .getByPlaceholder(t('billing_search_placeholder'))
      .fill(member.name)
    const job = controller.getByRole('row').filter({ hasText: member.name })
    await expect(job).toContainText(t('billing_unpaid'))
    await expect(job).toContainText(euros(34))

    await job.getByRole('button', { name: t('billing_mark_paid') }).click()
    await expect(
      job.getByRole('button', { name: t('billing_mark_unpaid') }),
    ).toBeVisible()
    await expect(job).not.toContainText(t('billing_unpaid'))
  })

  await test.step('The stringer’s labour is now owed', async () => {
    await header(controller)
      .getByRole('link', { name: t('nav_payouts') })
      .click()
    await expectBalance(15, 0, 15)
  })

  const dialog = controller.getByRole('dialog', {
    name: t('payouts_reimburse_title', { name: stringer.name }),
  })

  await test.step('Controller cannot pay out more than is owed', async () => {
    await stringerBalance
      .getByRole('button', { name: t('payouts_reimburse') })
      .click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(euros(15))

    await dialog.getByLabel(t('payouts_amount'), { exact: true }).fill('20')
    await dialog.getByRole('button', { name: t('payouts_reimburse') }).click()
    // Rejected by the server, which recomputes the balance itself.
    await expect(dialog).toContainText(t('payouts_exceeds_outstanding'))
  })

  await test.step('Controller pays out part of it', async () => {
    await dialog.getByLabel(t('payouts_amount'), { exact: true }).fill('10')
    await dialog.getByLabel(t('payouts_note'), { exact: true }).fill(payoutNote)
    await dialog.getByRole('button', { name: t('payouts_reimburse') }).click()
    await expect(dialog).toBeHidden()
  })

  await test.step('Balance and ledger record the payout', async () => {
    await expectBalance(15, 10, 5)

    // Found by stringer, not by note: the ledger keeps earlier runs' entries,
    // and only the stringer's name is unique to this one.
    const entry = ledger.getByRole('row').filter({ hasText: stringer.name })
    await expect(entry).toHaveCount(1)
    await expect(entry).toContainText(payoutNote)
    await expect(entry).toContainText(euros(10))
    await expect(entry).toContainText(accountant.name)
  })
})
