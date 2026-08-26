import {test, expect} from '@playwright/test';

/**
 * Accessibility checks that are cheap, deterministic and would otherwise rot silently.
 * Not a substitute for an audit — a floor, not a ceiling.
 */

test('every public page has exactly one h1', async ({page}) => {
  for (const route of ['', '/courses', '/projects', '/events', '/news', '/verify']) {
    await page.goto(`/ar${route}`);
    const count = await page.locator('h1').count();
    expect(count, `h1 count on /ar${route}`).toBe(1);
  }
});

test('the skip link is the first focusable element and works', async ({page}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');

  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('href', '#main');
  await expect(focused).toBeVisible();   // sr-only until focused
});

test('the binary decoration is hidden from assistive tech', async ({page}) => {
  // 300 binary digits announced aloud would be a serious defect, so this is asserted
  // rather than trusted. claude.md §8.
  await page.goto('/ar');
  const bars = page.locator('.hmk-binary-bar');
  const n = await bars.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(bars.nth(i)).toHaveAttribute('aria-hidden', 'true');
  }
});

test('interactive controls carry accessible names', async ({page}) => {
  await page.goto('/en');
  for (const btn of await page.getByRole('button').all()) {
    const name = (await btn.getAttribute('aria-label')) ?? (await btn.innerText());
    expect(name?.trim(), 'a button with no accessible name').toBeTruthy();
  }
});

test('focus is visible on keyboard navigation', async ({page}) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outline = await page
    .locator(':focus')
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline, 'focus-visible outline').not.toBe('none');
});
