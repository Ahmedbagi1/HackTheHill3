import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = 'http://localhost:5174';
const entry = `${origin}/tests/browser/harness.html`;
let server;
let db;

test.beforeAll(async () => {
  server = await createServer({
    root, configFile: false, envDir: false, plugins: [react()],
    server: { host: 'localhost', port: 5174, strictPort: true },
    define: {
      'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify('civicos-browser-test.auth0.com'),
      'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify('browser_test_client'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://civicos-browser-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_browser_test'),
    },
  });
  await server.listen();
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.jwt() to authenticated;
  `);
  for (const filename of ['202609260001_application_foundation.sql', '202609260002_service_definitions.sql', '202609260003_application_api.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
  }
  await db.exec("insert into civicos_private.auth_configuration (issuer, client_id) values ('https://civicos-browser-test.auth0.com/', 'browser_test_client')");
});
test.afterEach(async () => { await db?.close(); });

async function wireDatabase(page, controls = {}) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: {} });
      return route.continue();
    }
    if (url.hostname !== 'civicos-browser-test.supabase.co') return route.abort();
    if (controls.offline) return route.abort();
    const token = request.headers().authorization?.replace('Bearer test-only-token:', '');
    const claims = { sub: token, iss: 'https://civicos-browser-test.auth0.com/', aud: 'browser_test_client', role: 'authenticated', email_verified: true };
    try {
      const body = request.postDataJSON();
      const result = await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        await tx.exec('set local role authenticated');
        if (url.pathname.endsWith('/rpc/civicos_application_health')) return (await tx.query('select public.civicos_application_health() as data')).rows[0].data;
        if (url.pathname.endsWith('/rpc/submit_application')) {
          controls.keys ??= []; controls.keys.push(body.p_idempotency_key);
          return (await tx.query('select public.submit_application($1,$2,$3,$4) as data', [body.p_service_id, JSON.stringify(body.p_payload), body.p_idempotency_key, body.p_schema_version])).rows[0].data;
        }
        if (url.pathname.endsWith('/rpc/apply_application_action')) return (await tx.query('select public.apply_application_action($1,$2,$3,$4,$5) as data', [body.p_application_id, body.p_expected_revision, body.p_action, body.p_operation_key, body.p_note])).rows[0].data;
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 100);
        if (url.pathname.endsWith('/applications')) {
          const id = url.searchParams.get('id')?.slice(3);
          return (await tx.query(id
            ? "select * from public.applications where module = 'service' and id = $1"
            : "select * from public.applications where module = 'service' order by submitted_at desc, id desc offset $1 limit $2", id ? [id] : [offset, limit])).rows;
        }
        if (url.pathname.endsWith('/application_events')) return (await tx.query('select * from public.application_events where application_id = $1 order by application_revision offset $2 limit $3', [url.searchParams.get('application_id')?.slice(3), offset, limit])).rows;
        throw new Error('Unexpected test endpoint');
      });
      if (controls.loseSubmissionResponse && url.pathname.endsWith('/rpc/submit_application')) {
        controls.loseSubmissionResponse = false;
        return route.abort(); // The real SQL transaction already committed.
      }
      if (controls.loseActionResponse && url.pathname.endsWith('/rpc/apply_application_action')) {
        controls.loseActionResponse = false;
        return route.abort();
      }
      return route.fulfill({ json: result });
    } catch (error) {
      return route.fulfill({ status: 400, json: { code: error.code ?? 'TEST_ERROR', message: error.message } });
    }
  });
}

async function fillApplication(page) {
  await page.goto(`${entry}#/services`);
  await page.getByRole('searchbox').fill('gst');
  await page.locator('article.card').filter({ hasText: 'GST/HST Credit' }).getByRole('button', { name: 'Start application' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Demo environment/)).toBeVisible();
  await dialog.locator('[name="maritalStatus"][value="single"]').check();
  await dialog.locator('[name="afni"]').fill('12345');
  await dialog.locator('[name="children"]').fill('1');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.locator('[name="filedTaxes"][value="yes"]').check();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.locator('[name="consent"]').check();
  await dialog.locator('[name="demoAcknowledged"]').check();
  return dialog;
}

test('full UI saves to SQL, reloads full answers, exports and records prototype lifecycle; accounts stay isolated', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await wireDatabase(page);
  const dialog = await fillApplication(page);
  await dialog.getByRole('button', { name: 'Submit application', exact: true }).click();
  await expect(dialog.getByText('Saved to your CivicOS account')).toBeVisible();
  const reference = await dialog.locator('.success__ref').innerText();
  expect(reference).toMatch(/^CIV-[A-F0-9]{32}$/);
  expect((await db.query('select count(*) from public.applications')).rows[0].count).toBe(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('civicos:data:')))).toEqual([]);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto(`${entry}#/`);
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Saved answers' })).toBeVisible();
  await expect(dialog.locator('.review-list')).toContainText(['$12,345']);
  const [download] = await Promise.all([
    page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download saved application' }).click(),
  ]);
  const html = await readFile(await download.path(), 'utf8');
  expect(html).toContain(reference); expect(html).toContain('12,345');
  expect(html).toContain('Nothing was submitted to a government service');
  await dialog.getByRole('button', { name: 'Start prototype review' }).click();
  await dialog.getByRole('button', { name: 'Request test information' }).click();
  await dialog.getByLabel('Additional test information').fill('Synthetic response for browser test.');
  await dialog.getByRole('button', { name: 'Send test information' }).click();
  await dialog.getByRole('button', { name: 'Complete prototype review' }).click();
  await expect(dialog.locator('.timeline__label').last()).toHaveText('Completed');
  expect((await db.query('select count(*) from public.application_events')).rows[0].count).toBe(5);
  await page.evaluate(() => window.changeTestAccount(null));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.changeTestAccount('auth0|browser-b'));
  await expect(page.getByText('No saved requests', { exact: true })).toBeVisible();
  await page.evaluate(() => window.changeTestAccount('auth0|browser-a'));
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(dialog.locator('.timeline__label').last()).toHaveText('Completed');
  expect(pageErrors).toEqual([]);
});

test('a committed submission with a lost response never claims success and retries without duplication', async ({ page }) => {
  const controls = { loseSubmissionResponse: true };
  await wireDatabase(page, controls);
  const dialog = await fillApplication(page);
  await dialog.getByRole('button', { name: 'Submit application', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not confirm');
  await expect(dialog.getByText('Saved to your CivicOS account')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Retry save' }).click();
  await expect(dialog.getByText('Saved to your CivicOS account')).toBeVisible();
  expect(controls.keys).toHaveLength(2); expect(controls.keys[0]).toBe(controls.keys[1]);
  expect((await db.query('select count(*) from public.applications')).rows[0].count).toBe(1);
});

test('storage outages show an error without an empty-list success or demo fallback; logout clears drafts', async ({ page }) => {
  await wireDatabase(page, { offline: true });
  await page.goto(entry);
  await expect(page.getByRole('alert').filter({ hasText: 'Application storage could not confirm' })).toBeVisible();
  await expect(page.getByText('No saved requests', { exact: true })).toHaveCount(0);
  await expect(page.locator('article.request')).toHaveCount(0);
  const dialog = await fillApplication(page);
  await page.evaluate(() => window.changeTestAccount(null));
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[name="afni"]')).toHaveCount(0);
});

test('withdrawal survives a lost response and refresh, preserves history, and fits a mobile screen', async ({ page }) => {
  const controls = { loseActionResponse: true };
  await wireDatabase(page, controls);
  await page.setViewportSize({ width: 375, height: 812 });
  const dialog = await fillApplication(page);
  await dialog.getByRole('button', { name: 'Submit application', exact: true }).click();
  await expect(dialog.getByText('Saved to your CivicOS account')).toBeVisible();
  // Check the changed dialog; directory navigation has independently scrollable chips.
  expect(await dialog.evaluate((element) => element.getBoundingClientRect().right <= innerWidth && element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto(`${entry}#/`);
  await page.getByRole('button', { name: 'View details' }).click();
  page.once('dialog', (confirmation) => confirmation.accept());
  await dialog.getByRole('button', { name: 'Withdraw application', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not confirm');
  await dialog.getByRole('button', { name: 'Retry same status change' }).click();
  await expect(dialog.locator('.timeline__label').last()).toHaveText('Withdrawn');
  expect(await dialog.evaluate((element) => element.getBoundingClientRect().right <= innerWidth && element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(page.locator('.request__status')).toHaveText('Withdrawn');
  await expect(page.getByRole('button', { name: /^Withdraw / })).toHaveCount(0);
  expect((await db.query('select count(*) from public.applications')).rows[0].count).toBe(1);
  expect((await db.query('select count(*) from public.application_events')).rows[0].count).toBe(2);
});
