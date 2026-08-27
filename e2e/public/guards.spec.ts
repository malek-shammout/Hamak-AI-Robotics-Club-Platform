import {test, expect} from '@playwright/test';

/**
 * Every authenticated route must redirect a signed-out visitor to sign-in, preserving
 * the locale. A guard that leaks the page for even a frame is a guard that failed.
 */
const GUARDED = [
  '/me/applications',
  '/me/enrollments',
  '/me/certificates',
  '/me/consultations',
  '/me/consultations/new',
  '/me/expertise',
  '/staff/cohorts',
  '/staff/questions',
  '/staff/grading',
  '/staff/clearance',
  '/staff/desk',
  '/staff/checkouts',
  '/staff/liabilities',
  '/staff/assets',
  '/staff/requisitions',
  '/staff/consultations',
  '/staff/expertise',
  '/staff',
  '/staff/projects',
  '/staff/projects/new',
  '/staff/events',
  '/staff/events/new',
  '/staff/articles',
  '/staff/articles/new',
] as const;

for (const route of GUARDED) {
  test(`${route} redirects a signed-out visitor to sign-in`, async ({page}) => {
    await page.goto(`/en${route}`);
    await expect(page).toHaveURL(/\/en\/login$/);
  });
}

test('the guard preserves the Arabic locale', async ({page}) => {
  await page.context().clearCookies();
  await page.goto('/ar/staff/clearance');
  await expect(page).toHaveURL(/\/ar\/login$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('the certificate document API refuses an unauthenticated caller', async ({request}) => {
  // The bytes must never be reachable without a session, whatever the id.
  const res = await request.get(
    '/api/certificates/00000000-0000-0000-0000-000000000000/document'
  );
  expect(res.status()).toBe(401);
});
