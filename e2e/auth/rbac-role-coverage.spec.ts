import {expect, test} from '@playwright/test';
import {signIn, STAFF_ROLE_CREDENTIALS} from './fixtures';

const ROLE_MATRIX = {
  PROJECTS: ['/staff', '/staff/projects', '/staff/news', '/staff/consultations'],
  TRAINING: ['/staff', '/staff/cohorts', '/staff/questions'],
  LOGISTICS: ['/staff', '/staff/requisitions', '/staff/desk'],
  ADMIN: ['/staff', '/staff/projects', '/staff/news', '/staff/requisitions', '/staff/clearance'],
} as const;

for (const [role, routes] of Object.entries(ROLE_MATRIX) as [keyof typeof ROLE_MATRIX, readonly string[]][]) {
  const email = STAFF_ROLE_CREDENTIALS[role].email;
  const password = STAFF_ROLE_CREDENTIALS[role].password;

  test.describe(`${role} staff route coverage`, () => {
    test.skip(!email || !password, `${role} credentials missing; set E2E_${role}_EMAIL / E2E_${role}_PASSWORD`);

    test(`${role} can reach the staff pages it should be able to see`, async ({page}) => {
      test.slow();
      await page.context().clearCookies();
      await signIn(page, 'en', email, password);

      for (const route of routes) {
        await page.goto(`/en${route}`, {waitUntil: 'domcontentloaded'});
        await expect
          .poll(() => page.url(), {timeout: 60_000})
          .toContain(`/en${route}`);
        await expect(page.locator('main')).toBeVisible({timeout: 60_000});
      }
    });
  });
}
