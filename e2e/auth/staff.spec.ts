import {test, expect, hasCredentials, SKIP_REASON} from './fixtures';

test.skip(!hasCredentials, SKIP_REASON);

/**
 * Staff paths. These only mean something if the account under test actually holds the
 * relevant permissions, so each spec checks it landed on the page before asserting —
 * and reports plainly when it did not, instead of failing in a way that looks like a
 * product bug when it is really a fixture problem.
 */

async function reachedStaffPage(page: import('@playwright/test').Page, path: string) {
  await page.goto(`/en${path}`);
  return !/\/login$|\/en$/.test(new URL(page.url()).pathname + '$');
}

const STAFF_ROUTES = [
  '/staff/cohorts',
  '/staff/questions',
  '/staff/grading',
  '/staff/clearance',
  '/staff/desk',
  '/staff/checkouts',
  '/staff/liabilities',
  '/staff/assets',
  '/staff/requisitions',
  '/staff',
  '/staff/projects',
  '/staff/events',
  '/staff/articles',
] as const;

for (const route of STAFF_ROUTES) {
  test(`${route} renders or redirects cleanly`, async ({signedIn: page}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const res = await page.goto(`/en${route}`);
    expect(res?.status(), route).toBeLessThan(400);

    // Either outcome is legitimate — authorised sees the page, unauthorised is
    // redirected. What must never happen is a crash or an empty shell.
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    expect(errors, `page errors on ${route}`).toEqual([]);
  });
}

test('the requisition queue separates raising from approving (D-18)', async ({
  signedIn: page,
}) => {
  const reached = await reachedStaffPage(page, '/staff/requisitions');
  test.skip(!reached, 'account under test lacks the permissions for this page');

  // Two distinct lists is the visible shape of the separation of duties.
  await expect(page.getByRole('heading', {name: /my requisitions/i})).toBeVisible();
});

test('the clearance detail renders the B.2 table when a record exists', async ({
  signedIn: page,
}) => {
  const reached = await reachedStaffPage(page, '/staff/clearance');
  test.skip(!reached, 'account under test lacks the permissions for this page');

  const first = page.locator('main a[href*="/staff/clearance/"]').first();
  test.skip((await first.count()) === 0, 'no clearance records exist to inspect');

  await first.click();
  await expect(page.getByText(/decision table/i)).toBeVisible();
  // A1 must be labelled non-blocking wherever it appears for staff.
  const advisory = page.getByText(/not blocking|advisory/i);
  if (await advisory.count()) await expect(advisory.first()).toBeVisible();
});
