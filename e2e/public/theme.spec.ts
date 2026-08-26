import {test, expect} from '@playwright/test';

test('the theme toggle switches and persists', async ({page}) => {
  await page.goto('/en');

  const before = await page.locator('html').getAttribute('class');
  await page.getByRole('button', {name: /toggle theme/i}).click();

  await expect
    .poll(async () => page.locator('html').getAttribute('class'))
    .not.toBe(before);

  // Zustand mirrors next-themes; the choice must survive a reload.
  const after = await page.locator('html').getAttribute('class');
  await page.reload();
  await expect.poll(async () => page.locator('html').getAttribute('class')).toBe(after);
});

test('body background actually changes with the theme', async ({page}) => {
  // A class flip that does not repaint means the tokens are not wired up.
  await page.goto('/en');
  const bg = () => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);

  const before = await bg();
  await page.getByRole('button', {name: /toggle theme/i}).click();
  await expect.poll(bg).not.toBe(before);
});
