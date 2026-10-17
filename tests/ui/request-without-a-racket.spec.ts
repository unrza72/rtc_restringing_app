import { expect, test } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { currentCrumb, header, signIn, t } from './support'

test('a member with no racket yet requests a restring, and the stand-in racket stays out of sight', async ({
  page,
}) => {
  const member = await createApprovedUser('member', 'Mitglied')

  await test.step('Member opens the request form without having a racket', async () => {
    await signIn(page, member.email, member.password)
    await header(page)
      .getByRole('link', { name: t('dash_new_request') })
      .click()
    await expect(page).toHaveURL(/\/requests\/new$/)

    // No dead end: the form is there, just without the racket picker.
    await expect(page.getByText(t('request_no_racket_hint'))).toBeVisible()
    await expect(
      page.getByLabel(t('request_racket'), { exact: true }),
    ).toHaveCount(0)
  })

  await test.step('Member requests a restring', async () => {
    await page.getByLabel(t('request_source_club'), { exact: true }).check()
    await page.getByLabel(t('request_club_string'), { exact: true }).click()
    await page.getByRole('option', { name: /Luxilon ALU Power/ }).click()
    await page.getByLabel(t('request_tension_main'), { exact: true }).fill('24')
    await page.getByRole('button', { name: t('request_submit') }).click()

    await expect(page).toHaveURL(/\/requests\/(?!new$)[\w-]+$/)
    await expect(currentCrumb(page)).toHaveText(t('racket_default_label'))
    await expect(
      page
        .getByRole('main')
        .getByText(t('status_REQUESTED'), { exact: true })
        .first(),
    ).toBeVisible()
  })

  await test.step('The stand-in racket is not listed under "my rackets"', async () => {
    await header(page)
      .getByRole('link', { name: t('nav_rackets') })
      .click()
    await expect(page.getByText(t('racket_empty'))).toBeVisible()
    await expect(
      page.getByRole('main').getByText(t('racket_default_label')),
    ).toHaveCount(0)
  })

  await test.step('Once the member adds a racket, only that one is offered', async () => {
    await page
      .getByRole('main')
      .getByRole('link', { name: t('racket_add') })
      .click()
    await page.getByLabel(t('racket_label'), { exact: true }).fill('Pure Drive')
    await page.getByRole('button', { name: t('racket_add') }).click()
    await expect(currentCrumb(page)).toHaveText('Pure Drive')

    await header(page)
      .getByRole('link', { name: t('dash_new_request') })
      .click()
    await expect(page.getByText(t('request_no_racket_hint'))).toHaveCount(0)
    await page.getByLabel(t('request_racket'), { exact: true }).click()
    await expect(page.getByRole('option')).toHaveText(['Pure Drive'])
  })

  await test.step('The first request is still on record', async () => {
    await page.keyboard.press('Escape')
    await header(page)
      .getByRole('link', { name: t('nav_requests') })
      .click()
    await expect(page.getByRole('main')).toContainText(
      t('racket_default_label'),
    )
  })
})
