import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import de from '../../messages/de.json' with { type: 'json' }

type MessageKey = Exclude<keyof typeof de, '$schema'>

/**
 * UI copy, read from the same file the app renders — German, since that is the
 * base locale a member gets on plain paths. Tests find controls by role and
 * label rather than CSS, so this keeps them working through wording changes,
 * and a mistyped key fails the type check instead of a test run.
 */
export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return de[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  )
}

/**
 * A euro amount as the app prints it in German, e.g. `euros(40)` matches
 * "40,00 €". `\s` because the currency format puts a non-breaking space before
 * the sign.
 */
export const euros = (amount: number) =>
  new RegExp(`${amount.toFixed(2).replace('.', ',')}\\s€`)

/** The sticky app header with the main navigation. */
export const header = (page: Page) => page.getByRole('banner')

/** The last breadcrumb — the name of whatever page we are on. */
export const currentCrumb = (page: Page) =>
  page
    .getByRole('navigation', { name: t('breadcrumb_nav_label') })
    .locator('[aria-current="page"]')

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(t('auth_email')).fill(email)
  await page.getByLabel(t('auth_password')).fill(password)
  await page.getByRole('button', { name: t('auth_sign_in_action') }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

let counter = 0

/**
 * A suffix no other run has used. In `--ui` mode the database is only reset
 * when the UI opens, not on every re-run, so fixed names and emails would
 * already be taken the second time round. The counter keeps two calls in the
 * same millisecond apart.
 */
export function uniqueStamp() {
  counter += 1
  return `${Date.now().toString(36)}${counter.toString(36)}`
}

/** A member nobody has used yet, to sign up through the UI. */
export function newMember() {
  const stamp = uniqueStamp()
  return {
    name: `Neues Mitglied ${stamp}`,
    email: `member-${stamp}@e2e.test`,
    password: 'e2e-member-password',
  }
}

/** Picks a carabiner number in the request form's dropdown. */
export async function pickToken(page: Page, token: number) {
  await page.getByLabel(t('request_token'), { exact: true }).click()
  await page.getByRole('option', { name: String(token), exact: true }).click()
}
