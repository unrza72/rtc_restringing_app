import { expect, test } from '@playwright/test'

import { ADMIN } from './env'
import { header, signIn, t } from './support'

// Every page an admin can reach, so the policy is exercised on all of them.
const PAGES = [
  '/dashboard',
  '/rackets',
  '/rackets/new',
  '/requests',
  '/requests/new',
  '/queue',
  '/billing',
  '/billing/payouts',
  '/invites',
  '/admin/members',
  '/admin/audit',
  '/admin/strings',
  '/training',
  '/training/people',
  '/training/plans',
  '/help',
  '/imprint',
  '/privacy',
]

test('every page sends the security headers and runs without breaking its CSP', async ({
  page,
}) => {
  // Collected in the page itself: the browser reports each blocked script,
  // style or font as a `securitypolicyviolation` event.
  await page.addInitScript(() => {
    const seen: Array<string> = []
    Object.assign(window, { __cspViolations: seen })
    document.addEventListener('securitypolicyviolation', (e) => {
      seen.push(
        `${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`,
      )
    })
  })
  const pageErrors: Array<string> = []
  page.on('pageerror', (error) =>
    pageErrors.push(`${new URL(page.url()).pathname}: ${error.message}`),
  )

  await test.step('The login page carries the headers, with a fresh nonce each time', async () => {
    const first = await page.goto('/login')
    const headers = first!.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    const csp = headers['content-security-policy']
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toMatch(/script-src 'self' 'nonce-[\w+/=]+'(;|$)/)

    const again = await page.goto('/login')
    expect(again!.headers()['content-security-policy']).not.toBe(csp)
  })

  await test.step('Signing in still works, so hydrated scripts run', async () => {
    await signIn(page, ADMIN.email, ADMIN.password)
  })

  for (const path of PAGES) {
    await test.step(`${path} renders without a CSP violation`, async () => {
      await page.goto(path)
      await expect(header(page)).toBeVisible()
      // Fonts and lazy chunks load after the document; let them settle.
      await page.waitForLoadState('networkidle')
      expect(
        await page.evaluate(
          () => (window as { __cspViolations?: Array<string> }).__cspViolations,
        ),
      ).toEqual([])
    })
  }

  await test.step('Client-side navigation still works', async () => {
    await header(page)
      .getByRole('link', { name: t('nav_rackets') })
      .click()
    await expect(page).toHaveURL(/\/rackets$/)
  })

  expect(pageErrors).toEqual([])
})
