import { expect, test } from '@playwright/test'

import { createApprovedUser, createOpenRequest, freeToken } from './fixtures'
import { PHONE, expectNoHorizontalOverflow, signIn, t } from './support'

test.use({ viewport: PHONE })

test('a stringer works the queue on a phone without scrolling sideways', async ({
  page,
}) => {
  const operator = await createApprovedUser('operator', 'Besaiter')
  const member = await createApprovedUser('member', 'Mitglied')
  const token = await freeToken()
  await createOpenRequest(member, {
    racket: 'Pure Strike',
    clubString: 'Babolat RPM Blast',
    tensionMain: 24,
    token,
  })
  await createOpenRequest(member, {
    racket: 'Ezone 98',
    clubString: 'Wilson Synthetic Gut',
    tensionMain: 23,
    tensionCross: 22,
    token: await freeToken(),
  })

  await test.step('The queue fits the screen', async () => {
    await signIn(page, operator.email, operator.password)
    await page.goto('/queue')
    await expect(
      page.getByRole('heading', { name: t('queue_title') }),
    ).toBeVisible()
    // Every filter fully on screen — not tucked into a row that scrolls
    // sideways, which the page-overflow check alone would let through.
    for (const filter of [
      t('queue_filter_open'),
      t('queue_filter_mine'),
      t('status_REQUESTED'),
      t('status_ACCEPTED'),
      t('status_DONE'),
      t('status_COLLECTED'),
      t('status_CANCELLED'),
    ]) {
      await expect(
        page.getByRole('link', { name: filter, exact: true }),
      ).toBeInViewport({ ratio: 1 })
    }
    await page.getByPlaceholder(t('queue_search_placeholder')).fill(member.name)
    await expectNoHorizontalOverflow(page)
  })

  await test.step('Each job shows what a stringer needs at a glance', async () => {
    const job = page.getByRole('link').filter({ hasText: 'Pure Strike' })
    await expect(job).toHaveCount(1)
    await expect(job).toContainText(String(token))
    await expect(job).toContainText(member.name)
    await expect(job).toContainText('Babolat RPM Blast')
    await expect(job).toContainText(t('status_REQUESTED'))
    await job.click()
    await expect(page).toHaveURL(/\/queue\/(?!$)[\w-]+$/)
  })

  await test.step('The job and the "mark as done" form fit too', async () => {
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: t('queue_accept') }).click()
    await page.getByRole('button', { name: t('queue_complete') }).click()
    await expect(page.getByText(t('queue_complete_title'))).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
