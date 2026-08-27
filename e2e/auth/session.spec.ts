import {test, expect, hasCredentials, SKIP_REASON, signIn} from './fixtures';

test.skip(!hasCredentials, SKIP_REASON);

test('signing in reaches the member area and the header reflects it', async ({page}) => {
  await signIn(page);

  // The header must switch from "Sign in" to the signed-in cluster. If it does not,
  // the session cookie is not reaching Server Components.
  await expect(page.getByRole('link', {name: /sign in|تسجيل الدخول/i})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /sign out|تسجيل الخروج/i})).toBeVisible();
});

test('the session survives a full page reload', async ({page}) => {
  await signIn(page);
  await page.goto('/en/me/applications');
  await page.reload();

  // A session that only exists client-side would bounce to /login here.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
});

test('the session survives a language switch', async ({page}) => {
  await signIn(page);
  await page.goto('/en/me/applications');
  await page.getByRole('button', {name: /العربية/i}).click();

  await expect(page).toHaveURL(/\/ar\/me\/applications$/);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('signing out ends the session and re-guards the member area', async ({page}) => {
  await signIn(page);
  await page.getByRole('button', {name: /sign out|تسجيل الخروج/i}).click();

  // Wait for the sign-out to LAND before navigating away. `signOut` redirects to
  // `/{locale}`, so this is the observable end of the action.
  //
  // Without it the test races itself: under sustained load — the full auth pass performs
  // ~50 real sign-ins on one worker — the POST can still be in flight when the goto()
  // below fires, the guard then correctly admits a session that is still valid, and the
  // failure reads as "sign-out does not work" when what actually happened is that it had
  // not happened yet. Observed intermittently three times before this was added.
  await expect(page).toHaveURL(/\/en$/, {timeout: 15_000});

  await page.goto('/en/me/applications');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('sign-in errors do not reveal whether an account exists', async ({page}) => {
  // Distinguishing "no such account" from "wrong password" turns the form into an
  // account-enumeration oracle. Both must produce the same message.
  await page.goto('/en/login');
  await page.getByLabel(/email/i).fill('definitely-not-a-user@example.invalid');
  await page.getByLabel(/password/i).fill('WrongPassword123');
  await page.getByRole('button', {name: /sign in/i}).click();

  const unknown = await page.getByRole('alert').innerText();

  await page.goto('/en/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill('DefinitelyTheWrongPassword123');
  await page.getByRole('button', {name: /sign in/i}).click();

  const wrongPassword = await page.getByRole('alert').innerText();

  expect(wrongPassword.trim()).toBe(unknown.trim());
});
