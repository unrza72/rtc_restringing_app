import { expect, test } from '@playwright/test'

import { ADMIN } from './env'
import {
  createApprovedUser,
  createFinishedJob,
  highestTokenInUse,
} from './fixtures'
import { currentCrumb, header, pickToken, signIn, t } from './support'

test('a carabiner on one racket cannot be used for another until it is picked up', async ({
  page: admin,
  browser,
}) => {
  const holder = await createApprovedUser('member', 'Mitglied')
  const newcomer = await createApprovedUser('member', 'Neuling')
  const stringer = await createApprovedUser('operator', 'Besaiter')

  // Above every number earlier runs left in use, so it is the highest one and
  // at least 2 — the count can then be tried at one below it.
  const carabiner = (await highestTokenInUse()) + 2
  const job = await createFinishedJob(holder, stringer, {
    racket: 'Pro Staff',
    clubString: 'Luxilon ALU Power',
    tensionMain: 24,
    labourPriceCents: 1500,
    token: carabiner,
  })
  const count = carabiner + 5

  const holderContext = await browser.newContext()
  const holderPage = await holderContext.newPage()
  const newcomerContext = await browser.newContext()
  const newcomerPage = await newcomerContext.newPage()

  const tokenField = () =>
    newcomerPage.getByLabel(t('request_token'), { exact: true })
  const submit = () =>
    newcomerPage.getByRole('button', { name: t('request_submit') }).click()

  await test.step('Admin cannot lower the count below a carabiner in use', async () => {
    await signIn(admin, ADMIN.email, ADMIN.password)
    await header(admin)
      .getByRole('link', { name: t('nav_admin_strings') })
      .click()
    const countField = admin.getByLabel(t('admin_token_count'), {
      exact: true,
    })
    // The page has other settings with their own Save button.
    const tokenForm = admin.locator('form').filter({ has: countField })

    await countField.fill(String(carabiner - 1))
    await tokenForm.getByRole('button', { name: t('common_save') }).click()
    await expect(
      admin.getByText(
        t('admin_token_count_below_in_use', { token: carabiner }),
      ),
    ).toBeVisible()
  })

  await test.step('Admin sets the number of carabiners', async () => {
    const countField = admin.getByLabel(t('admin_token_count'), {
      exact: true,
    })
    await countField.fill(String(count))
    await admin
      .locator('form')
      .filter({ has: countField })
      .getByRole('button', { name: t('common_save') })
      .click()
    await expect(
      admin
        .getByRole('status')
        .filter({ hasText: t('admin_token_count_saved') }),
    ).toBeVisible()
  })

  await test.step('Newcomer sees the carabiner on a racket, but cannot pick it', async () => {
    await signIn(newcomerPage, newcomer.email, newcomer.password)
    await header(newcomerPage)
      .getByRole('link', { name: t('dash_new_request') })
      .click()
    await tokenField().click()

    // Every carabiner the club has is listed — and only those.
    await expect(newcomerPage.getByRole('option')).toHaveCount(count)
    const taken = newcomerPage.getByRole('option', {
      name: t('request_token_option_taken', { token: carabiner }),
    })
    await expect(taken).toBeVisible()
    await expect(taken).toBeDisabled()
    await newcomerPage.keyboard.press('Escape')
  })

  await test.step('The first member picks up their racket', async () => {
    await signIn(holderPage, holder.email, holder.password)
    await holderPage.goto(`/requests/${job.id}`)
    await expect(holderPage.getByRole('main')).toContainText(String(carabiner))
    await holderPage.getByRole('button', { name: t('queue_collect') }).click()
    await expect(
      holderPage
        .getByRole('main')
        .getByText(t('status_COLLECTED'), { exact: true })
        .first(),
    ).toBeVisible()
  })

  await test.step('Now the newcomer can use that carabiner', async () => {
    await newcomerPage.reload()
    await pickToken(newcomerPage, carabiner)
    await submit()
    await expect(newcomerPage).toHaveURL(/\/requests\/(?!new$)[\w-]+$/)
    await expect(currentCrumb(newcomerPage)).toHaveText(
      t('racket_default_label'),
    )
    await expect(newcomerPage.getByRole('main')).toContainText(
      t('request_token'),
    )
  })

  await test.step('The stringer finds the racket by its carabiner', async () => {
    await header(admin)
      .getByRole('link', { name: t('nav_queue') })
      .click()
    await admin
      .getByPlaceholder(t('queue_search_placeholder'))
      .fill(newcomer.name)
    const row = admin.getByRole('row').filter({ hasText: newcomer.name })
    await expect(row.getByRole('cell').first()).toHaveText(String(carabiner))
  })

  await holderContext.close()
  await newcomerContext.close()
})
