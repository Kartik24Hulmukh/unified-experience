/**
 * BErozgar — Playwright E2E Configuration
 *
 * Runs against the full local stack:
 *   - Vite dev server on port 8080 (proxies /api → localhost:3001)
 *   - Fastify API on port 3001
 *   - PostgreSQL on port 5433 (Docker)
 *
 * Email provider must be 'log' — OTPs are read directly from the database.
 */

import { defineConfig, devices } from '@playwright/test';

const E2E_WEB_BASE_URL = (
  process.env.E2E_BASE_URL ??
  process.env.E2E_WEB_URL ??
  'http://127.0.0.1:8080'
).replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — tests depend on each other (signup → login → listing → …)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: E2E_WEB_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* No webServer block — we start the stack manually or via the test helper */
});
