import {defineConfig, devices} from '@playwright/test';
import path from 'node:path';

/** Shared session written by e2e/auth/auth.setup.ts. Gitignored — holds a live token. */
const AUTH_STATE = path.join(__dirname, 'e2e/.auth/staff.json');

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
    // ---------------------------------------------------------------- public
    {name: 'chromium', testDir: './e2e/public', use: {...devices['Desktop Chrome']}},
    // Arabic is the default locale and RTL is where layout bugs hide, so a mobile
    // viewport is not optional decoration here.
    {name: 'mobile-rtl', testDir: './e2e/public', use: {...devices['Pixel 7'], locale: 'ar'}},

    // ---------------------------------------------------------------- signed in
    // One real sign-in for the whole suite. Previously every test signed in, which at 62
    // tests exceeded Supabase's auth rate limit; the rejections then surfaced as
    // `signIn()` never leaving /login, which reads like a broken login page rather than a
    // throttled one.
    {name: 'setup', testMatch: /auth\.setup\.ts/},

    // Read-only signed-in specs. They reuse the stored session and never sign out, so
    // they are safe to run in parallel again.
    {
      name: 'authed-chromium',
      testDir: './e2e/auth',
      testIgnore: [/auth\.setup\.ts/, /session\.spec\.ts/],
      use: {...devices['Desktop Chrome'], storageState: AUTH_STATE},
      dependencies: ['setup'],
    },
    {
      name: 'authed-mobile-rtl',
      testDir: './e2e/auth',
      testIgnore: [/auth\.setup\.ts/, /session\.spec\.ts/],
      use: {...devices['Pixel 7'], locale: 'ar', storageState: AUTH_STATE},
      dependencies: ['setup'],
    },

    // The auth lifecycle itself. These sign in and out for real, and sign-out is GLOBAL
    // (D-24) — it revokes the shared session above. So they run LAST, after everything
    // that depends on that session has finished.
    // Chromium only, deliberately. Signing in and out is not a layout concern, and the
    // mobile-RTL viewport already covers every read-only signed-in view via
    // authed-mobile-rtl. Running this file on both projects doubled the real password
    // grants for no extra coverage, and Supabase throttles them per IP — which surfaced
    // as `signIn()` never leaving /login, i.e. as if the login page were broken.
    {
      name: 'session-chromium',
      testMatch: /session\.spec\.ts/,
      use: {...devices['Desktop Chrome']},
      dependencies: ['authed-chromium', 'authed-mobile-rtl'],
    },
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
