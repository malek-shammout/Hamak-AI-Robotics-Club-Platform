import {test as base, expect, type Page} from '@playwright/test';

/**
 * Fixtures for the signed-in specs.
 *
 * These need a real account. Creating one is not something the tooling does — an auth
 * identity is a credential and credentials belong to the club — so the credentials come
 * from the environment.
 *
 * When they are absent the specs SKIP AND SAY SO. They do not pass. A suite that goes
 * green because it quietly tested nothing is worse than one that does not run: it
 * reports safety that was never established.
 */
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

export const test = base.extend<{signedIn: Page}>({
  signedIn: async ({page}, use) => {
    await signIn(page);
    await use(page);
  },
});

export {expect};
