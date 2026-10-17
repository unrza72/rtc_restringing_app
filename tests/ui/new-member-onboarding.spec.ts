import { expect, test } from '@playwright/test'

import { ADMIN } from './env'
import { freeToken } from './fixtures'
import {
  currentCrumb,
  header,
  newMember,
  pickToken,
  signIn,
  t,
} from './support'

test('a newcomer joins through an invite link, is shown around, adds a racket and requests a restring', async ({
  page: admin,
  browser,
}) => {
  const member = newMember()
  const racket = {
    label: 'Blauer Pure Drive',
    brand: 'Babolat',
    model: 'Pure Drive 100',
  }

  // A second, separate browser session — the newcomer is on their own device.
  const newcomerContext = await browser.newContext()
  const newcomer = await newcomerContext.newPage()

  const inviteUrl =
    await test.step('Admin creates an invite link', async () => {
      await signIn(admin, ADMIN.email, ADMIN.password)
      await header(admin)
        .getByRole('link', { name: t('nav_invites') })
        .click()
      await admin.getByRole('button', { name: t('invites_create') }).click()

      // The new link is shown in the create card, above the table that lists it
      // again — the first one on the page is the one just made.
      const link = admin.locator('code').filter({ hasText: '/signup?token=' })
      await expect(link.first()).toBeVisible()
      const url = await link.first().textContent()
      expect(url).toBeTruthy()
      return url!
    })

  await test.step('Newcomer opens the link and signs up', async () => {
    await newcomer.goto(inviteUrl)
    await newcomer.getByLabel(t('auth_name'), { exact: true }).fill(member.name)
    await newcomer
      .getByLabel(t('auth_email'), { exact: true })
      .fill(member.email)
    await newcomer
      .getByLabel(t('auth_password'), { exact: true })
      .fill(member.password)
    await newcomer
      .getByRole('button', { name: t('auth_sign_up_action') })
      .click()

    // Signed in, but parked until an admin approves the account.
    await expect(newcomer).toHaveURL(/\/pending$/)
    await expect(
      newcomer.getByRole('heading', { name: t('pending_title') }),
    ).toBeVisible()
  })

  await test.step('Admin approves the newcomer', async () => {
    await header(admin)
      .getByRole('link', { name: t('nav_admin_members') })
      .click()
    const entry = admin.getByRole('listitem').filter({ hasText: member.email })
    await entry.getByRole('button', { name: t('admin_approve') }).click()
    await expect(entry).toContainText(t('member_status_APPROVED'))
  })

  await test.step('Newcomer is let in and welcomed with a tour', async () => {
    await newcomer.reload()
    await expect(newcomer).toHaveURL(/\/dashboard$/)

    // While the tour is open the page behind it is hidden from the
    // accessibility tree, so the dashboard heading is checked after it.
    const tour = newcomer.getByRole('dialog')
    const heading = (key: Parameters<typeof t>[0]) =>
      tour.getByRole('heading', { name: t(key) })
    await expect(heading('onboarding_welcome_title')).toBeVisible()
    await tour.getByRole('button', { name: t('onboarding_start') }).click()

    await expect(heading('onboarding_request_title')).toBeVisible()
    // Carabiners are switched on for these tests, so the tour mentions them.
    await expect(tour).toContainText(t('onboarding_request_step_token'))
    await tour.getByRole('button', { name: t('onboarding_next') }).click()

    await expect(heading('onboarding_handover_title')).toBeVisible()
    await expect(tour).toContainText(t('status_DONE'))
    await tour.getByRole('button', { name: t('onboarding_next') }).click()

    await expect(heading('onboarding_offer_title')).toBeVisible()
    await tour
      .getByRole('button', { name: t('onboarding_offer_accept') })
      .click()

    await expect(heading('onboarding_rackets_title')).toBeVisible()
    // Closing records the tour as seen in the background; wait for that
    // write before the reload below checks it stuck.
    const recorded = newcomer.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/_serverFn/'),
    )
    await tour
      .getByRole('button', { name: t('onboarding_finish'), exact: true })
      .click()
    await expect(tour).toBeHidden()
    expect((await recorded).ok()).toBe(true)

    await expect(
      newcomer.getByRole('heading', {
        name: t('dash_title', { name: member.name }),
      }),
    ).toBeVisible()
  })

  await test.step('The tour stays closed, but can be replayed', async () => {
    await newcomer.reload()
    await expect(
      newcomer.getByRole('heading', {
        name: t('dash_title', { name: member.name }),
      }),
    ).toBeVisible()
    await expect(newcomer.getByRole('dialog')).toHaveCount(0)

    await newcomer
      .getByRole('main')
      .getByRole('button', { name: t('onboarding_replay') })
      .click()
    const tour = newcomer.getByRole('dialog')
    await expect(
      tour.getByRole('heading', { name: t('onboarding_welcome_title') }),
    ).toBeVisible()
    await newcomer.keyboard.press('Escape')
    await expect(tour).toBeHidden()

    // The header offers it on every page, not only the dashboard.
    await header(newcomer)
      .getByRole('link', { name: t('nav_requests') })
      .click()
    await header(newcomer)
      .getByRole('button', { name: t('onboarding_replay') })
      .click()
    await expect(
      tour.getByRole('heading', { name: t('onboarding_welcome_title') }),
    ).toBeVisible()
    await tour.getByRole('button', { name: t('onboarding_skip') }).click()
    await expect(tour).toBeHidden()
  })

  await test.step('Newcomer adds a racket', async () => {
    await header(newcomer)
      .getByRole('link', { name: t('nav_rackets') })
      .click()
    await expect(newcomer.getByText(t('racket_empty'))).toBeVisible()
    await newcomer
      .getByRole('main')
      .getByRole('link', { name: t('racket_add') })
      .click()
    await expect(newcomer).toHaveURL(/\/rackets\/new$/)

    await newcomer
      .getByLabel(t('racket_label'), { exact: true })
      .fill(racket.label)
    await newcomer
      .getByRole('button', { name: t('racket_add_details') })
      .click()
    await newcomer
      .getByLabel(t('racket_brand'), { exact: true })
      .fill(racket.brand)
    await newcomer
      .getByLabel(t('racket_model'), { exact: true })
      .fill(racket.model)
    await newcomer.getByRole('button', { name: t('racket_add') }).click()

    await expect(newcomer).toHaveURL(/\/rackets\/(?!new$)[\w-]+$/)
    await expect(currentCrumb(newcomer)).toHaveText(racket.label)
  })

  await test.step('Newcomer requests a restring', async () => {
    await header(newcomer)
      .getByRole('link', { name: t('dash_new_request') })
      .click()
    await expect(newcomer).toHaveURL(/\/requests\/new$/)

    await newcomer.getByLabel(t('request_racket'), { exact: true }).click()
    await newcomer.getByRole('option', { name: racket.label }).click()

    await newcomer.getByLabel(t('request_source_club'), { exact: true }).check()
    await newcomer.getByLabel(t('request_club_string'), { exact: true }).click()
    await newcomer.getByRole('option', { name: /Luxilon ALU Power/ }).click()

    await newcomer
      .getByLabel(t('request_tension_main'), { exact: true })
      .fill('24')
    await newcomer
      .getByLabel(t('request_tension_cross'), { exact: true })
      .fill('23')
    await newcomer
      .getByLabel(t('request_notes'), { exact: true })
      .fill('Bitte bis Samstag, danke!')
    await pickToken(newcomer, await freeToken())
    await newcomer.getByRole('button', { name: t('request_submit') }).click()
  })

  await test.step('The request is on record, waiting for a stringer', async () => {
    await expect(newcomer).toHaveURL(/\/requests\/(?!new$)[\w-]+$/)
    await expect(currentCrumb(newcomer)).toHaveText(racket.label)
    const main = newcomer.getByRole('main')
    await expect(main).toContainText('Luxilon ALU Power')
    await expect(
      main.getByText(t('status_REQUESTED'), { exact: true }).first(),
    ).toBeVisible()

    await header(newcomer)
      .getByRole('link', { name: t('nav_requests') })
      .click()
    await expect(newcomer.getByRole('main')).toContainText(racket.label)
  })

  await newcomerContext.close()
})
