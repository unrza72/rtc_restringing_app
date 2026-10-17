import { expect, test } from '@playwright/test'

import { createApprovedUser, createOpenRequest } from './fixtures'
import { euros, header, signIn, t } from './support'

test('a stringer picks a job out of the queue, strings it and marks it as done', async ({
  page: stringer,
}) => {
  const operator = await createApprovedUser('operator', 'Besaiter')
  const member = await createApprovedUser('member', 'Mitglied')
  const job = await createOpenRequest(member, {
    racket: 'Pure Aero',
    clubString: 'Luxilon ALU Power',
    tensionMain: 25,
    tensionCross: 24,
  })
  const notes = 'Neu bespannt, Griffband gleich mitgewechselt.'

  await test.step('Stringer signs in and opens the queue', async () => {
    await signIn(stringer, operator.email, operator.password)
    await header(stringer)
      .getByRole('link', { name: t('nav_queue') })
      .click()
    await expect(
      stringer.getByRole('heading', { name: t('queue_title') }),
    ).toBeVisible()
  })

  await test.step('Stringer finds the member’s job and opens it', async () => {
    // The queue may hold other jobs, so narrow it down the way a stringer
    // would when a member asks after their racket.
    await stringer
      .getByPlaceholder(t('queue_search_placeholder'))
      .fill(member.name)
    const row = stringer.getByRole('row').filter({ hasText: member.name })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(t('status_REQUESTED'))
    await expect(row).toContainText(t('request_unassigned'))

    await row.getByRole('link', { name: 'Pure Aero' }).click()
    await expect(stringer).toHaveURL(new RegExp(`/queue/${job.id}$`))
  })

  await test.step('Stringer takes the job', async () => {
    await stringer.getByRole('button', { name: t('queue_accept') }).click()

    const main = stringer.getByRole('main')
    await expect(main).toContainText(t('status_ACCEPTED'))
    await expect(main).toContainText(operator.name)
    // Once claimed, only the claiming stringer can finish or hand it back.
    await expect(
      stringer.getByRole('button', { name: t('queue_release') }),
    ).toBeVisible()
  })

  await test.step('Stringer records what was strung and marks it as done', async () => {
    await stringer.getByRole('button', { name: t('queue_complete') }).click()
    await expect(stringer.getByText(t('queue_complete_title'))).toBeVisible()

    // Everything the request already said comes prefilled — the stringer only
    // corrects what actually differed and adds the labour.
    await expect(
      stringer.getByLabel(t('queue_used_string'), { exact: true }),
    ).toHaveValue('Luxilon ALU Power 1.25')
    await expect(
      stringer.getByLabel(t('queue_used_tension_main'), { exact: true }),
    ).toHaveValue('25')
    await expect(
      stringer.getByLabel(t('queue_used_tension_cross'), { exact: true }),
    ).toHaveValue('24')
    await expect(
      stringer.getByLabel(t('queue_string_price'), { exact: true }),
    ).toHaveValue('25.00')

    await stringer
      .getByLabel(t('queue_labour_price'), { exact: true })
      .fill('15')
    await stringer
      .getByLabel(t('queue_operator_notes'), { exact: true })
      .fill(notes)
    await stringer.getByRole('button', { name: t('queue_complete') }).click()
  })

  await test.step('The job is ready for pickup', async () => {
    const main = stringer.getByRole('main')
    await expect(main).toContainText(t('status_DONE'))
    await expect(main).toContainText('Luxilon ALU Power 1.25')
    // 25,00 € string + 15,00 € labour.
    await expect(main).toContainText(euros(40))
    await expect(main).toContainText(notes)
    // Nothing left for the stringer to do on it — the member collects it.
    await expect(
      stringer.getByRole('button', { name: t('queue_complete') }),
    ).toHaveCount(0)

    // Still listed under the stringer's own jobs until it is picked up.
    await header(stringer)
      .getByRole('link', { name: t('nav_queue') })
      .click()
    await stringer
      .getByRole('main')
      .getByRole('link', { name: t('queue_filter_mine'), exact: true })
      .click()
    await expect(stringer).toHaveURL(/[?&]mine=true/)
    const row = stringer.getByRole('row').filter({ hasText: member.name })
    await expect(row).toContainText(t('status_DONE'))
  })
})
