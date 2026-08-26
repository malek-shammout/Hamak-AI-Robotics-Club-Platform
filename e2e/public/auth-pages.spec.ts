import {test, expect} from '@playwright/test';

/**
 * The sign-in and registration pages, and the detail routes.
 *
 * These are the routes the broad smoke spec cannot cover: the auth pages because they
 * are about form structure rather than content, and the detail routes because with an
 * empty database the only correct answer is a clean 404.
 */

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} auth pages render`, async ({page}) => {
    for (const route of ['/login', '/register', '/register/check-email']) {
      const res = await page.goto(`/${locale}${route}`);
      expect(res?.status(), `${locale}${route}`).toBeLessThan(400);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        locale === 'ar' ? 'rtl' : 'ltr'
      );
    }
  });
}

test('registration collects BOTH name forms — bilingual by construction', async ({page}) => {
  // claude.md §5: a member record without both name forms cannot render correctly on
  // the other locale's pages, so the form must not let one be skipped.
  await page.goto('/ar/register');
  await expect(page.locator('#fullNameAr')).toBeVisible();
  await expect(page.locator('#fullNameEn')).toBeVisible();
  await expect(page.locator('#fullNameAr')).toHaveAttribute('required', '');
  await expect(page.locator('#fullNameEn')).toHaveAttribute('required', '');
});

test('content-script fields carry their own direction on the Arabic page', async ({page}) => {
  // An English name field inheriting rtl renders right-aligned and reads wrongly; the
  // same for an email or password, which are always Latin.
  await page.goto('/ar/register');
  await expect(page.locator('#fullNameAr')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#fullNameEn')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#email')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#password')).toHaveAttribute('dir', 'ltr');
});

test('the password hint states the real policy', async ({page}) => {
  // The hint must match the Supabase policy (8 chars, upper+lower+digit). If they
  // drift, users hit a server rejection they cannot act on.
  await page.goto('/en/register');
  const hint = await page.locator('#password-hint').innerText();
  expect(hint).toMatch(/8/);
  expect(hint).toMatch(/uppercase/i);
  expect(hint).toMatch(/digit|number/i);
});

test('an already-signed-out visitor is not bounced away from /login', async ({page}) => {
  // /login redirects only when a session EXISTS. A redirect loop here would lock
  // everyone out, so it is worth an explicit assertion.
  await page.context().clearCookies();
  await page.goto('/en/login');
  await expect(page).toHaveURL(/\/en\/login$/);
});

const DETAIL_ROUTES = [
  '/courses/does-not-exist',
  '/projects/does-not-exist',
  '/events/does-not-exist',
  '/news/does-not-exist',
] as const;

for (const route of DETAIL_ROUTES) {
  test(`${route} 404s cleanly rather than erroring`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const res = await page.goto(`/ar${route}`);
    // A missing record must be a 404, never a 500 — an unhandled query result would
    // show as the latter.
    expect(res?.status(), route).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
    expect(errors, `page errors on ${route}`).toEqual([]);
  });
}
