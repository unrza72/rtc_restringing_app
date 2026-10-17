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

test('a newcomer joins through an invite link, adds a racket and requests a restring', async ({
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

  await test.step('Newcomer is let in', async () => {
    await newcomer.reload()
    await expect(newcomer).toHaveURL(/\/dashboard$/)
    await expect(
      newcomer.getByRole('heading', {
        name: t('dash_title', { name: member.name }),
      }),
    ).toBeVisible()
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
