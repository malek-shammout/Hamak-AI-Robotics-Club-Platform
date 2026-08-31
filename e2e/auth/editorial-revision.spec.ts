import {expect, test, type Page} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

const authorEmail = process.env.E2E_PROJECTS_EMAIL || process.env.E2E_EMAIL;
const authorPassword = process.env.E2E_PROJECTS_PASSWORD || process.env.E2E_PASSWORD;
const approverEmail = process.env.E2E_ADMIN_EMAIL;
const approverPassword = process.env.E2E_ADMIN_PASSWORD;

const configured = Boolean(
  authorEmail &&
    authorPassword &&
    approverEmail &&
    approverPassword &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

test.describe.serial('editorial rejection, revision, and unpublishing', () => {
  test.skip(!configured, 'Author and approver credentials plus Supabase service access are required.');

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function signIn(page: Page, email: string, password: string) {
    await page.context().clearCookies();
    await page.goto('/en/login');
    await page.getByLabel(/email|البريد/i).fill(email);
    await page.getByLabel(/password|كلمة المرور/i).fill(password);
    await page.getByRole('button', {name: /sign in|تسجيل الدخول/i}).click();
    await expect(page).not.toHaveURL(/\/login/, {timeout: 30_000});
  }

  async function cleanup(table: 'projects' | 'events' | 'articles', column: 'code' | 'slug', value: string) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {persistSession: false},
    });
    const {error} = await client.from(table).delete().ilike(column, `${value}%`);
    if (error) throw new Error(`cleanup failed for ${table}: ${error.message}`);
  }

  async function openItem(page: Page, listRoute: string, title: string) {
    await page.goto(`/en${listRoute}`);
    const link = page.getByRole('link', {name: new RegExp(title, 'i')}).first();
    await expect(link).toBeVisible({timeout: 30_000});
    await link.click();
    await expect(page.getByText(/current state/i)).toBeVisible();
  }

  async function rejectReviseResubmit(
    page: Page,
    listRoute: string,
    title: string,
    revisedField: string,
    revisedValue: string
  ) {
    await openItem(page, listRoute, title);
    await expect(page.getByRole('button', {name: /^reject$/i})).toBeVisible();
    await page.getByRole('button', {name: /^reject$/i}).click();
    await expect(page.getByText(/rejected/i)).toBeVisible();

    await signIn(page, authorEmail!, authorPassword!);
    await openItem(page, listRoute, title);
    await expect(page.getByRole('button', {name: /submit for review/i})).toBeVisible();
    await page.getByLabel(new RegExp(`^${revisedField}$`, 'i')).fill(revisedValue);
    await page.getByRole('button', {name: /^save$/i}).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);
    await page.getByRole('button', {name: /submit for review/i}).click();
    await expect(page.getByText(/pending review/i)).toBeVisible();
  }

  async function approveAndUnpublish(page: Page, listRoute: string, title: string) {
    await signIn(page, approverEmail!, approverPassword!);
    await openItem(page, listRoute, title);
    await page.getByRole('button', {name: /^publish$/i}).click();
    await expect(page.getByText(/published/i)).toBeVisible();
    await page.getByRole('button', {name: /^unpublish$/i}).click();
    await expect(page.getByText(/draft/i)).toBeVisible();
  }

  test('project rejection, revision, resubmission, publication, and unpublishing', async ({page}) => {
    test.slow();
    const prefix = uniqueName('EDITORIAL-PROJECT');
    const code = prefix.toUpperCase();
    const title = `${prefix} Project`;

    try {
      await signIn(page, authorEmail!, authorPassword!);
      await page.goto('/en/staff/projects/new');
      await page.getByLabel(/code/i).fill(code);
      await page.getByLabel(/title ar/i).fill(`${title} عربي`);
      await page.getByLabel(/title en/i).fill(title);
      await page.getByLabel(/abstract/i).fill('Initial project draft.');
      await page.getByRole('button', {name: /create/i}).click();
      await expect(page.getByRole('status')).toContainText(/saved/i);
      await openItem(page, '/staff/projects', title);
      await expect(page.getByRole('button', {name: /publish/i})).toHaveCount(0);
      await page.getByRole('button', {name: /submit for review/i}).click();
      await expect(page.getByText(/pending review/i)).toBeVisible();

      await signIn(page, approverEmail!, approverPassword!);
      await rejectReviseResubmit(page, '/staff/projects', title, 'abstract', 'Revised project draft.');
      await approveAndUnpublish(page, '/staff/projects', title);
    } finally {
      await cleanup('projects', 'code', prefix);
    }
  });

  test('event rejection, revision, resubmission, publication, and unpublishing', async ({page}) => {
    test.slow();
    const prefix = uniqueName('EDITORIAL-EVENT');
    const code = prefix.toUpperCase();
    const title = `${prefix} Event`;

    try {
      await signIn(page, authorEmail!, authorPassword!);
      await page.goto('/en/staff/events/new');
      await page.getByLabel(/code/i).fill(code);
      await page.getByLabel(/title ar/i).fill(`${title} عربي`);
      await page.getByLabel(/title en/i).fill(title);
      await page.getByLabel(/description/i).fill('Initial event draft.');
      await page.getByLabel(/starts at/i).fill('2030-12-01T09:00');
      await page.getByLabel(/ends at/i).fill('2030-12-01T11:00');
      await page.getByLabel(/eligibility/i).selectOption('PUBLIC');
      await page.getByRole('button', {name: /create/i}).click();
      await expect(page.getByRole('status')).toContainText(/saved/i);
      await openItem(page, '/staff/events', title);
      await expect(page.getByRole('button', {name: /publish/i})).toHaveCount(0);
      await page.getByRole('button', {name: /submit for review/i}).click();
      await expect(page.getByText(/pending review/i)).toBeVisible();

      await signIn(page, approverEmail!, approverPassword!);
      await rejectReviseResubmit(page, '/staff/events', title, 'description', 'Revised event draft.');
      await approveAndUnpublish(page, '/staff/events', title);
    } finally {
      await cleanup('events', 'code', prefix);
    }
  });

  test('article rejection, revision, resubmission, publication, and unpublishing', async ({page}) => {
    test.slow();
    const prefix = uniqueName('EDITORIAL-ARTICLE').toLowerCase();
    const slug = prefix.replace(/[^a-z0-9-]+/g, '-');
    const title = `${prefix} Article`;

    try {
      await signIn(page, authorEmail!, authorPassword!);
      await page.goto('/en/staff/articles/new');
      await page.getByLabel(/slug/i).fill(slug);
      await page.getByLabel(/title/i).fill(title);
      await page.getByLabel(/summary/i).fill('Initial article draft.');
      await page.getByLabel(/body/i).fill('Initial article body.');
      await page.getByRole('button', {name: /create/i}).click();
      await expect(page.getByRole('status')).toContainText(/saved/i);
      await openItem(page, '/staff/articles', title);
      await expect(page.getByRole('button', {name: /publish/i})).toHaveCount(0);
      await page.getByRole('button', {name: /submit for review/i}).click();
      await expect(page.getByText(/pending review/i)).toBeVisible();

      await signIn(page, approverEmail!, approverPassword!);
      await rejectReviseResubmit(page, '/staff/articles', title, 'body', 'Revised article body.');
      await approveAndUnpublish(page, '/staff/articles', title);
    } finally {
      await cleanup('articles', 'slug', slug);
    }
  });
});
