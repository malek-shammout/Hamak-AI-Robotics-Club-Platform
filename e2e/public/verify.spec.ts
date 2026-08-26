import {test, expect} from '@playwright/test';

/**
 * BR-10: certificate verification must work for a third party with no account at all.
 * These run signed OUT on purpose — that is the whole point of the rule.
 */

test('the verification page is reachable without an account', async ({page}) => {
  await page.goto('/en/verify');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await expect(page.getByLabel(/verification code/i)).toBeVisible();
});

test('an unknown code reports not-found rather than erroring', async ({page}) => {
  await page.goto('/en/verify?code=00000000000000000000000000000000');
  await expect(page.getByText(/no certificate matches/i)).toBeVisible();
});

test('a malformed code is handled without a server error', async ({page}) => {
  // The RPC rejects implausible input before touching the table; the page must not 500.
  const res = await page.goto('/en/verify?code=short');
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator('main')).toBeVisible();
});

test('the code field is LTR even on the Arabic page', async ({page}) => {
  // A hex code rendered RTL is unreadable and un-pasteable.
  await page.goto('/ar/verify');
  await expect(page.locator('#code')).toHaveAttribute('dir', 'ltr');
});
