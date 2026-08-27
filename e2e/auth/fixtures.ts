import {test as base, expect, type Page} from '@playwright/test';
import path from 'node:path';

/**
 * Fixtures for the signed-in specs.
 *
 * SIGN-OUT IS GLOBAL (D-24), so any spec that signs out revokes EVERY session for the
 * account — including the shared one saved by auth.setup.ts. That is why:
 *
 *   - read-only specs (member, staff) reuse the stored session and never sign out;
 *   - the session-lifecycle specs run in a LATER project, on a single worker, and do
 *     their own sign-ins.
 *
 * Run in parallel against one shared account, the sign-out spec kills its neighbours
 * mid-flight and they fail looking exactly like a session-persistence bug in the
 * product. It is not one: the same five specs passed 5/5 serially and 3/5 in parallel.
 *
 * Do not "fix" a future failure here by relaxing the session assertions. Check the
 * project ordering and worker count first.
 *
 * These need a real account. Creating one is not something the tooling does — an auth
 * identity is a credential and credentials belong to the club — so the credentials come
 * from the environment.
 *
 * When they are absent the specs SKIP AND SAY SO. They do not pass. A suite that goes
 * green because it quietly tested nothing is worse than one that does not run: it
 * reports safety that was never established.
 */
/** Where auth.setup.ts stores the shared session. Gitignored — it holds a live token. */
export const STORAGE_STATE = path.join(__dirname, '../.auth/staff.json');

export const E2E_EMAIL = process.env.E2E_EMAIL;
export const E2E_PASSWORD = process.env.E2E_PASSWORD;
export const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

export const SKIP_REASON =
  'E2E_EMAIL / E2E_PASSWORD not set — signed-in paths were NOT verified. ' +
  'Create a throwaway member in Supabase and re-run: ' +
  'E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e';

export async function signIn(page: Page, locale: 'ar' | 'en' = 'en') {
  await page.goto(`/${locale}/login`);

  // Addressed by label, so the test breaks if the field loses its accessible name —
  // which is a real defect — rather than when a class is renamed, which is not.
  await page.getByLabel(/email|البريد/i).fill(E2E_EMAIL!);
  await page.getByLabel(/password|كلمة المرور/i).fill(E2E_PASSWORD!);
  await page.getByRole('button', {name: /sign in|تسجيل الدخول/i}).click();

  // A successful sign-in leaves /login. Waiting on the URL rather than a toast means
  // the assertion holds regardless of what the destination page renders.
  await expect(page).not.toHaveURL(/\/login/, {timeout: 15_000});
}

/**
 * The signed-in page.
 *
 * This used to sign in per test. It no longer does: the `authed-*` Playwright projects
 * load the session saved once by auth.setup.ts, so the page arrives already
 * authenticated. Sixty-odd password grants per run was exceeding Supabase's auth rate
 * limit, and the rejections looked like a broken login page rather than a throttled one.
 *
 * Specs that exercise sign-in or sign-out THEMSELVES must not use this fixture — they
 * call `signIn()` directly and run in a later project, because sign-out is global (D-24)
 * and would revoke this shared session for everyone.
 */
export const test = base.extend<{signedIn: Page}>({
  signedIn: async ({page}, use) => {
    await use(page);
  },
});

export {expect};
