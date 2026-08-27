import {test as setup, expect} from '@playwright/test';
import {E2E_EMAIL, E2E_PASSWORD, hasCredentials, SKIP_REASON, STORAGE_STATE} from './fixtures';

setup.skip(!hasCredentials, SKIP_REASON);

/**
 * Signs in ONCE and saves the session for every read-only auth spec to reuse.
 *
 * Why this exists: the suite previously performed one real sign-in per test. At 62 tests
 * that is 62 password grants in under nine minutes, which exceeds Supabase's auth rate
 * limit — and the rejections surfaced as `signIn()` failing to leave /login, which reads
 * like a broken login page rather than a throttled one. Signing in once takes the whole
 * suite from ~62 grants to ~11.
 *
 * The saved file contains a LIVE session token. It is gitignored, and it must stay that
 * way.
 *
 * NOTE ON D-24: `signOut()` is global scope by club ruling, so any spec that signs out
 * revokes THIS stored session too. That is why the session-lifecycle specs live in a
 * separate Playwright project that runs after the specs relying on this state, and do
 * their own sign-ins rather than borrowing it.
 */
setup('authenticate once and store the session', async ({page}) => {
  await page.goto('/en/login');

  await page.getByLabel(/email|البريد/i).fill(E2E_EMAIL!);
  await page.getByLabel(/password|كلمة المرور/i).fill(E2E_PASSWORD!);
  await page.getByRole('button', {name: /sign in|تسجيل الدخول/i}).click();

  await expect(page).not.toHaveURL(/\/login/, {timeout: 15_000});

  // Prove the session is real before saving it. Storing a state that turns out not to be
  // signed in would make every dependent spec skip or fail for the wrong reason.
  await page.goto('/en/me/applications');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({path: STORAGE_STATE});
});
