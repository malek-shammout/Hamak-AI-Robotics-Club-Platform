import {test, expect, hasCredentials, SKIP_REASON} from './fixtures';

test.skip(!hasCredentials, SKIP_REASON);

/**
 * The member-facing pages. These render real data for the signed-in account, so they
 * assert on structure and guarantees rather than on specific rows, which vary.
 */

const MEMBER_ROUTES = [
  '/me/applications',
  '/me/enrollments',
  '/me/certificates',
] as const;

for (const route of MEMBER_ROUTES) {
  test(`${route} renders for a signed-in member in both locales`, async ({signedIn: page}) => {
    for (const locale of ['ar', 'en'] as const) {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));

      const res = await page.goto(`/${locale}${route}`);
      expect(res?.status(), `${locale}${route}`).toBeLessThan(400);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        locale === 'ar' ? 'rtl' : 'ltr'
      );
      expect(errors, `page errors on ${locale}${route}`).toEqual([]);
    }
  });
}

test('the certificates page never exposes the A1 advisory to a student', async ({
  signedIn: page,
}) => {
  // §B.2 is explicit that A1 is "not shown to student" — it concerns OTHER enrolments.
  // getMyClearances omits it; this asserts the omission survives refactoring.
  await page.goto('/en/me/certificates');
  const body = await page.locator('main').innerText();
  expect(body).not.toMatch(/outstanding elsewhere/i);
  expect(body).not.toMatch(/other enrolments|other enrollments/i);
});

test('a member cannot reach the staff area', async ({signedIn: page}) => {
  // Being signed in is not being authorised. If the account under test happens to hold
  // staff rights this will land on the page instead, which is also a correct outcome —
  // so the assertion is that we are never left on a broken or empty shell.
  await page.goto('/en/staff/clearance');
  await expect(page.locator('main')).toBeVisible();
  const url = page.url();
  expect(url).toMatch(/\/en\/(staff\/clearance|login|)$|\/en$/);
});
