import {defineConfig, devices} from '@playwright/test';

/**
 * E2E configuration.
 *
 * The suite is split by what it needs:
 *   e2e/public/  — no credentials. Always runs.
 *   e2e/auth/    — needs E2E_EMAIL / E2E_PASSWORD. Skips loudly when absent, rather
 *                  than passing vacuously, which would be worse than not running.
 *
 * `webServer` builds and starts the app itself, so the suite tests the PRODUCTION
 * build rather than the dev server. Dev-only behaviour (HMR, React strict double
 * renders, unminified errors) would otherwise mask real problems.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    // Arabic is the default locale and RTL is where layout bugs hide, so a mobile
    // viewport is not optional decoration here.
    {name: 'mobile-rtl', use: {...devices['Pixel 7'], locale: 'ar'}},
  ],

  webServer: {
    command: 'npm run build && npm run start -- --port 3100',
    url: 'http://localhost:3100/ar',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
