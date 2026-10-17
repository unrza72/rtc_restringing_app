import { defineConfig, devices } from '@playwright/test'

import { BASE_URL, PORT, SERVER_ENV } from './tests/ui/env'

/**
 * Browser tests for the common workflows. `pnpm test:ui` runs them headless;
 * `pnpm test:ui --ui` opens Playwright's UI mode to watch a run step by step.
 */
export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/global-setup.ts',
  // One shared database and one admin account; each test makes its own members.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A production build rather than `vite dev`: no on-the-fly dependency
  // optimiser to reload the page mid-test (or to fight a `pnpm dev` already
  // running on :4000 over the shared `node_modules/.vite` cache), and it tests
  // what actually ships. App changes need a rebuild, so restart `--ui` after
  // editing `src/`.
  webServer: {
    command:
      'pnpm build --logLevel error && pnpm exec dotenv -e .env -- node .output/server/index.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...SERVER_ENV, PORT: String(PORT) },
  },
})
