import { expect, test } from '@playwright/test'

import { createApprovedUser } from './fixtures'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('a member requests a restring straight from a racket, saving unsaved edits first', async ({
  page,
}) => {
  const member = await createApprovedUser('member', 'Mitglied')
  const main = page.getByRole('main')
  const requestButton = main.getByRole('button', {
    name: t('dash_new_request'),
  })
  const tensionMain = page.getByLabel(t('request_tension_main'), {
    exact: true,
  })

  async function addRacket(label: string) {
    await page.goto('/rackets/new')
    await page.getByLabel(t('racket_label'), { exact: true }).fill(label)
    await page.getByRole('button', { name: t('racket_add_details') }).click()
    await tensionMain.fill('23')
    await page.getByRole('button', { name: t('racket_add') }).click()
    await expect(page).toHaveURL(/\/rackets$/)
  }

  async function openRacket(label: string) {
    await page.goto('/rackets')
    await main.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(/\/rackets\/(?!new$)[\w-]+$/)
  }

  await test.step('Member has two rackets', async () => {
    await signIn(page, member.email, member.password)
    await addRacket('Alpha')
    await addRacket('Zeta')
  })

  await test.step('Without edits, the button opens the request form for that racket', async () => {
    await openRacket('Zeta')
    await requestButton.click()

    await expect(page).toHaveURL(/\/requests\/new\?racketId=/)
    await expect(
      page.getByLabel(t('request_racket'), { exact: true }),
    ).toHaveText('Zeta')
    await expect(tensionMain).toHaveValue('23')
  })

  const dialog = page.getByRole('dialog')

  await test.step('With an unsaved edit, a dialog asks first; cancel stays put', async () => {
    await openRacket('Zeta')
    await tensionMain.fill('25')
    await requestButton.click()

    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(t('racket_unsaved_title'))
    for (const name of [t('common_cancel'), t('racket_unsaved_save')]) {
      await expect(dialog.getByRole('button', { name })).toBeInViewport({
        ratio: 1,
      })
    }
    await expectNoHorizontalOverflow(page)

    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await expect(dialog).toBeHidden()
    await expect(tensionMain).toHaveValue('25')

    // From `sm:` up the buttons sit in one row; long German labels must wrap
    // rather than scroll the dialog sideways.
    await page.setViewportSize({ width: 1280, height: 800 })
    await requestButton.click()
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => dialog.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBe(0)
    await dialog.getByRole('button', { name: t('common_cancel') }).click()
    await page.setViewportSize(PHONE)
  })

  await test.step('"Save and continue" saves, then opens the request form', async () => {
    await requestButton.click()
    await dialog.getByRole('button', { name: t('racket_unsaved_save') }).click()

    await expect(page).toHaveURL(/\/requests\/new\?racketId=/)
    await expect(tensionMain).toHaveValue('25')
  })

  await test.step('After saving on the page itself, no dialog appears', async () => {
    await openRacket('Zeta')
    await tensionMain.fill('24')
    await main.getByRole('button', { name: t('common_save') }).click()
    await expect(
      main.getByRole('button', { name: t('common_save') }),
    ).toBeEnabled()
    await requestButton.click()

    await expect(page).toHaveURL(/\/requests\/new\?racketId=/)
    await expect(tensionMain).toHaveValue('24')
  })
})
