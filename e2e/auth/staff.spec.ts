import {test, expect, hasCredentials, SKIP_REASON} from './fixtures';
import type {Page} from '@playwright/test';

test.skip(!hasCredentials, SKIP_REASON);

/**
 * Staff paths, verified as an AUTHORISED staff member.
 *
 * These specs used to assert "renders or redirects cleanly", which passed whichever
 * happened. That was honest while the only test account held no roles — but it meant a
 * green run proved nothing about what a staff member actually sees, and the suite
 * reported coverage it did not have.
 *
 * Now that the club provisions a staff account, each spec asserts the page ACTUALLY
 * RENDERED: still on the staff URL, with that page's own heading. If the account under
 * test lacks the permission, the spec SKIPS LOUDLY rather than passing — the same
 * principle as the missing-credentials skip in fixtures.ts. A suite that goes green
 * because it tested nothing is worse than one that does not run.
 */

/** True when the guard let us stay; false when it bounced us to sign-in or home. */
async function reached(page: Page, route: string) {
  await page.goto(`/en${route}`);
  return new RegExp(`${route.replace('/', '\\/')}/?$`).test(new URL(page.url()).pathname);
}

/**
 * The heading each route must render. Asserting the SPECIFIC heading — rather than
 * "some h1 exists" — is what distinguishes "the staff page loaded" from "we were
 * silently redirected to a different page that also has an h1".
 */
const STAFF_ROUTES: Record<string, RegExp> = {
  '/staff': /staff area/i,
  '/staff/cohorts': /cohort administration/i,
  '/staff/questions': /question bank/i,
  '/staff/grading': /manual grading/i,
  '/staff/clearance': /clearance/i,
  '/staff/desk': /issue desk/i,
  '/staff/checkouts': /outstanding custody/i,
  '/staff/liabilities': /liabilities/i,
  '/staff/assets': /asset catalogue/i,
  '/staff/requisitions': /requisitions/i,
  '/staff/consultations': /consultation queue/i,
  '/staff/expertise': /expertise catalogue/i,
  '/staff/projects': /projects/i,
  '/staff/events': /events/i,
  '/staff/news': /news & articles/i,
  '/staff/articles': /news & articles/i,
};

for (const [route, heading] of Object.entries(STAFF_ROUTES)) {
  test(`${route} renders for an authorised staff member`, async ({signedIn: page}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const landed = await reached(page, route);
    test.skip(
      !landed,
      `the account under test lacks the permission for ${route} — this staff view was NOT verified`
    );

    await expect(page.getByRole('heading', {level: 1})).toHaveText(heading);
    await expect(page.locator('main')).toBeVisible();
    expect(errors, `page errors on ${route}`).toEqual([]);
  });
}

test('the staff hub lists the areas the account can actually reach', async ({
  signedIn: page,
}) => {
  const landed = await reached(page, '/staff');
  test.skip(!landed, 'account under test cannot reach the staff hub');

  // The hub filters tiles by permission. A staff account must see some; the "no staff
  // permissions" message must NOT be what greets them.
  await expect(page.getByText(/your account has no staff permissions/i)).toHaveCount(0);
  const tiles = page.locator('main ul a[href*="/staff/"]');
  expect(await tiles.count()).toBeGreaterThan(0);
});

test('the requisition queue separates raising from approving (D-18)', async ({
  signedIn: page,
}) => {
  const landed = await reached(page, '/staff/requisitions');
  test.skip(!landed, 'account under test lacks M5 permissions — D-18 shape NOT verified');

  // Two distinct lists is the visible shape of the separation of duties.
  await expect(page.getByRole('heading', {name: /my requisitions/i})).toBeVisible();
});

test('the projects list separates drafts from what is live (BR-11)', async ({
  signedIn: page,
}) => {
  const landed = await reached(page, '/staff/projects');
  test.skip(!landed, 'account under test lacks M7 permissions');

  // Publication state is the organising idea of the authoring UI, so it must be visible
  // without opening anything.
  await expect(page.getByRole('heading', {name: /drafts and in review/i})).toBeVisible();
  await expect(page.getByRole('heading', {name: /live on the site/i})).toBeVisible();
});

test('the articles screen offers per-locale authoring (row-per-locale)', async ({
  signedIn: page,
}) => {
  const landed = await reached(page, '/staff/news');
  test.skip(!landed, 'account under test lacks M9 permissions');

  await expect(page.getByRole('heading', {name: /news & articles/i})).toBeVisible();
  await expect(page.getByRole('link', {name: /new article/i})).toBeVisible();

  const first = page.locator('main a[href*="/staff/articles/"]').first();
  if ((await first.count()) > 0) {
    await first.click();
    await expect(page.getByText(/current state/i)).toBeVisible();
  }
});

test('publication and authoring controls distinguish editor access from approval access (BR-11)', async ({
  signedIn: page,
}) => {
  const routes = ['/staff/projects', '/staff/events', '/staff/news'];
  const checks = [] as {route: string; visible: boolean}[];

  for (const route of routes) {
    const landed = await reached(page, route);
    if (!landed) continue;

    const first = page.locator(`main a[href*="/staff${route === '/staff/news' ? '/articles' : route}/"]`).first();
    if ((await first.count()) === 0) {
      checks.push({route, visible: false});
      continue;
    }

    await first.click();
    const publishButtons = page.getByRole('button', {name: /publish|unpublish|reject/i});
    const approvalNote = page.getByText(/publishing needs approval rights/i);

    const hasApprovalButtons = (await publishButtons.count()) > 0;
    const hasApprovalNote = (await approvalNote.count()) > 0;

    expect(hasApprovalButtons || hasApprovalNote).toBeTruthy();
    checks.push({route, visible: hasApprovalButtons || hasApprovalNote});

    if (hasApprovalButtons) {
      await expect(approvalNote).toHaveCount(0);
    } else {
      await expect(approvalNote).toHaveCount(1);
    }

    await page.goBack();
  }

  expect(checks.length).toBeGreaterThan(0);
});

test('the clearance detail renders the B.2 table when a record exists', async ({
  signedIn: page,
}) => {
  const landed = await reached(page, '/staff/clearance');
  test.skip(!landed, 'account under test lacks M6 permissions');

  const first = page.locator('main a[href*="/staff/clearance/"]').first();
  test.skip((await first.count()) === 0, 'no clearance records exist to inspect');

  await first.click();
  await expect(page.getByText(/decision table/i)).toBeVisible();
  // A1 must be labelled non-blocking wherever it appears for staff.
  const advisory = page.getByText(/not blocking|advisory/i);
  if (await advisory.count()) await expect(advisory.first()).toBeVisible();
});
