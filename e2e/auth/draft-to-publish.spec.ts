import {expect, test, type Page} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

const authorEmail = process.env.E2E_PROJECTS_EMAIL || process.env.E2E_EMAIL;
const authorPassword = process.env.E2E_PROJECTS_PASSWORD || process.env.E2E_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const hasRequiredCredentials = Boolean(
  authorEmail &&
    authorPassword &&
    adminEmail &&
    adminPassword &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

test.describe.serial('draft-to-publish workflow', () => {
  test.skip(!hasRequiredCredentials, 'E2E role accounts are not configured for draft-to-publish validation.');

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function signIn(page: Page, email: string, password: string) {
    await page.goto('/en/login');
    await page.getByLabel(/email|البريد/i).fill(email);
    await page.getByLabel(/password|كلمة المرور/i).fill(password);
    await page.getByRole('button', {name: /sign in|تسجيل الدخول/i}).click();
    await expect(page).not.toHaveURL(/\/login/, {timeout: 20_000});
  }

  async function cleanupRow(table: 'projects' | 'events' | 'articles', column: 'code' | 'slug', prefix: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {persistSession: false},
    });

    await client.from(table).delete().ilike(column, `${prefix}%`);
  }

  test('project author creates a draft, submits for review, and the admin publishes it', async ({page}) => {
    test.slow();
    await page.context().clearCookies();
    const prefix = uniqueName('D2P-PROJECT');
    const code = prefix.toUpperCase();
    const title = `${prefix} Draft Project`;

    await signIn(page, authorEmail!, authorPassword!);
    await page.goto('/en/staff/projects');
    await page.getByRole('link', {name: /new project/i}).click();
    await expect(page).toHaveURL(/\/staff\/projects\/new/);

    await page.getByLabel(/code/i).fill(code);
    await page.getByLabel(/title ar/i).fill(`${title} عربي`);
    await page.getByLabel(/title en/i).fill(title);
    await page.getByLabel(/abstract/i).fill('Draft project created by the E2E workflow.');
    await page.getByRole('button', {name:/create/i}).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);

    await page.goto('/en/staff/projects');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();

    await expect(page.getByText(/publishing needs approval rights/i)).toBeVisible();
    await expect(page.getByRole('button', {name:/publish/i})).toHaveCount(0);

    await page.getByRole('button', {name:/submit for review/i}).click();
    await expect(page.getByText(/pending review/i)).toBeVisible();

    await signIn(page, adminEmail!, adminPassword!);
    await page.goto('/en/staff/projects');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();
    await expect(page.getByRole('button', {name:/publish/i})).toBeVisible();
    await page.getByRole('button', {name:/publish/i}).click();
    await expect(page.getByText(/published/i)).toBeVisible();

    await cleanupRow('projects', 'code', prefix);
  });

  test('event author creates a draft, submits for review, and the admin publishes it', async ({page}) => {
    test.slow();
    await page.context().clearCookies();
    const prefix = uniqueName('D2P-EVENT');
    const code = prefix.toUpperCase();
    const title = `${prefix} Draft Event`;

    await signIn(page, authorEmail!, authorPassword!);
    await page.goto('/en/staff/events');
    await page.getByRole('link', {name: /new event/i}).click();
    await expect(page).toHaveURL(/\/staff\/events\/new/);

    await page.getByLabel(/code/i).fill(code);
    await page.getByLabel(/title ar/i).fill(`${title} عربي`);
    await page.getByLabel(/title en/i).fill(title);
    await page.getByLabel(/description/i).fill('Draft event created by the E2E workflow.');
    await page.getByLabel(/starts at/i).fill('2030-12-01T09:00');
    await page.getByLabel(/ends at/i).fill('2030-12-01T11:00');
    await page.getByLabel(/eligibility/i).selectOption('PUBLIC');
    await page.getByRole('button', {name:/create/i}).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);

    await page.goto('/en/staff/events');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();

    await expect(page.getByText(/publishing needs approval rights/i)).toBeVisible();
    await expect(page.getByRole('button', {name:/publish/i})).toHaveCount(0);

    await page.getByRole('button', {name:/submit for review/i}).click();
    await expect(page.getByText(/pending review/i)).toBeVisible();

    await signIn(page, adminEmail!, adminPassword!);
    await page.goto('/en/staff/events');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();
    await expect(page.getByRole('button', {name:/publish/i})).toBeVisible();
    await page.getByRole('button', {name:/publish/i}).click();
    await expect(page.getByText(/published/i)).toBeVisible();

    await cleanupRow('events', 'code', prefix);
  });

  test('article author creates a draft, submits for review, and the admin publishes it', async ({page}) => {
    test.slow();
    await page.context().clearCookies();
    const prefix = uniqueName('D2P-ARTICLE');
    const slug = prefix.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const title = `${prefix} Draft Article`;

    await signIn(page, authorEmail!, authorPassword!);
    await page.goto('/en/staff/articles');
    await page.getByRole('link', {name: /new article/i}).click();
    await expect(page).toHaveURL(/\/staff\/articles\/new/);

    await page.getByLabel(/slug/i).fill(slug);
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/summary/i).fill('Draft article created by the E2E workflow.');
    await page.getByLabel(/body/i).fill('This is a draft article that is submitted for review and then published by an admin.');
    await page.getByRole('button', {name:/create/i}).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);

    await page.goto('/en/staff/articles');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();

    await expect(page.getByText(/publishing needs approval rights/i)).toBeVisible();
    await expect(page.getByRole('button', {name:/publish/i})).toHaveCount(0);

    await page.getByRole('button', {name:/submit for review/i}).click();
    await expect(page.getByText(/pending review/i)).toBeVisible();

    await signIn(page, adminEmail!, adminPassword!);
    await page.goto('/en/staff/articles');
    await expect(page.getByRole('link', {name: new RegExp(title, 'i')}).first()).toBeVisible();
    await page.getByRole('link', {name: new RegExp(title, 'i')}).first().click();
    await expect(page.getByRole('button', {name:/publish/i})).toBeVisible();
    await page.getByRole('button', {name:/publish/i}).click();
    await expect(page.getByText(/published/i)).toBeVisible();

    await cleanupRow('articles', 'slug', slug);
  });
});
