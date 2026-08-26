import {test, expect} from '@playwright/test';

/**
 * claude.md §7 is explicit that ar is the default and RTL, en is LTR, and the toggle
 * must preserve the current route. These are the assertions that catch a regression in
 * the locale plumbing, which is invisible if you only ever browse in English.
 */

test('ar is RTL and en is LTR', async ({page}) => {
  await page.goto('/ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('the language toggle preserves the current route', async ({page}) => {
  await page.goto('/en/courses');
  await page.getByRole('button', {name: /العربية|Switch to Arabic/i}).click();

  await expect(page).toHaveURL(/\/ar\/courses$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('the toggle preserves the query string too', async ({page}) => {
  // /verify carries state in the query; losing it on a language switch would drop the
  // code a visitor just pasted.
  await page.goto('/en/verify?code=abcdef0123456789abcdef0123456789');
  await page.getByRole('button', {name: /العربية|Switch to Arabic/i}).click();

  await expect(page).toHaveURL(/\/ar\/verify\?code=abcdef0123456789abcdef0123456789$/);
});

test('logical properties mirror the header between locales', async ({page}) => {
  // claude.md §7 forbids physical margins. If someone writes ml-auto instead of
  // ms-auto, the controls stop mirroring and this catches it.
  await page.goto('/en');
  const ltr = await page.locator('header .ms-auto').first().boundingBox();

  await page.goto('/ar');
  const rtl = await page.locator('header .ms-auto').first().boundingBox();

  expect(ltr, 'header controls present in LTR').toBeTruthy();
  expect(rtl, 'header controls present in RTL').toBeTruthy();
  // In LTR the control cluster sits right; in RTL it must sit left.
  expect(rtl!.x).toBeLessThan(ltr!.x);
});

test('numerals stay Western in Arabic (engineering context)', async ({page}) => {
  await page.goto('/ar/verify');
  const body = await page.locator('body').innerText();
  // Arabic-Indic digits would mean the number formatting drifted from §7.
  expect(body).not.toMatch(/[\u0660-\u0669]/);
});
