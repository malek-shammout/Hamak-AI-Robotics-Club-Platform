import {test, expect} from '@playwright/test';

/**
 * Every public route must render, in both locales, without a console error.
 *
 * This is deliberately broad and shallow: it is the net that catches a page which
 * throws on load, which no unit test would notice.
 */
const ROUTES = [
  '',
  '/courses',
  '/projects',
  '/events',
  '/news',
  '/verify',
] as const;

for (const locale of ['ar', 'en'] as const) {
  for (const route of ROUTES) {
    test(`${locale}${route || '/'} renders without console errors`, async ({page}) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(String(err)));

      const response = await page.goto(`/${locale}${route}`);
      expect(response?.status(), 'HTTP status').toBeLessThan(400);

      // A page that renders an empty shell is not "working".
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();

      // next-themes injects an inline script that React logs about on the client;
      // it is expected and harmless, so it is filtered rather than tolerated wholesale.
      const real = errors.filter(
        (e) => !/script tag while rendering|hydration/i.test(e)
      );
      expect(real, `console errors on /${locale}${route}`).toEqual([]);
    });
  }
}

test('an unknown path under a locale returns the localised 404', async ({page}) => {
  const res = await page.goto('/ar/definitely-not-a-real-page');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
