import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { header, signIn, t } from './support'

/** The help sections' headings, in the order the page lists them. */
const SECTION = {
  request: () => t('help_request_title'),
  rackets: () => t('help_rackets_title'),
  account: () => t('help_account_title'),
  queue: () => t('help_queue_title'),
  invites: () => t('help_invites_title'),
  billing: () => t('help_billing_title'),
  payouts: () => t('help_payouts_title'),
  training: () => t('help_training_title'),
  admin: () => t('help_admin_title'),
}
type SectionId = keyof typeof SECTION

async function openHelp(page: Page) {
  await header(page)
    .getByRole('link', { name: t('nav_help') })
    .click()
  await expect(page).toHaveURL(/\/help$/)
}

async function expectSections(page: Page, shown: Array<SectionId>) {
  const main = page.getByRole('main')
  for (const id of Object.keys(SECTION) as Array<SectionId>) {
    const heading = main.getByRole('heading', {
      level: 2,
      name: SECTION[id](),
      exact: true,
    })
    if (shown.includes(id)) await expect(heading).toBeVisible()
    else await expect(heading).toHaveCount(0)
  }
}

test('help explains only what the reader can do', async ({ browser }) => {
  await test.step('A member sees requesting, rackets and their account', async () => {
    const page = await browser.newPage()
    const member = await createApprovedUser('member', 'Hilfe Mitglied')
    await signIn(page, member.email, member.password)
    await openHelp(page)

    await expectSections(page, ['request', 'rackets', 'account'])
    // Carabiners are switched on for these tests, so their topic is there.
    await expect(page.getByRole('main')).toContainText(
      t('help_request_token_body'),
    )
    await page.close()
  })

  await test.step('A stringer also sees the queue, invites and prices — but not how to settle them', async () => {
    const page = await browser.newPage()
    const stringer = await createApprovedUser('operator', 'Hilfe Besaiter')
    await signIn(page, stringer.email, stringer.password)
    await openHelp(page)

    await expectSections(page, [
      'request',
      'rackets',
      'account',
      'queue',
      'invites',
      'billing',
    ])
    const main = page.getByRole('main')
    await expect(main).toContainText(t('help_billing_overview_title'))
    await expect(main).not.toContainText(t('help_billing_paid_title'))

    // A section links through to the page it explains.
    await main
      .getByRole('link', {
        name: t('help_open_page', { page: t('nav_queue') }),
      })
      .click()
    await expect(page).toHaveURL(/\/queue$/)
    await page.close()
  })

  await test.step('An admin sees every section', async () => {
    const page = await browser.newPage()
    const admin = await createApprovedUser('admin', 'Hilfe Admin')
    await signIn(page, admin.email, admin.password)
    await openHelp(page)

    await expectSections(page, Object.keys(SECTION) as Array<SectionId>)
    await expect(page.getByRole('main')).toContainText(
      t('help_billing_paid_title'),
    )

    // The tour can be started from here too.
    await page
      .getByRole('main')
      .getByRole('button', { name: t('help_start_tour') })
      .click()
    await expect(
      page
        .getByRole('dialog')
        .getByRole('heading', { name: t('onboarding_welcome_title') }),
    ).toBeVisible()
    await page.close()
  })
})
