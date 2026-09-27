import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
let dist;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

test.beforeAll(async () => {
  dist = await mkdtemp(join(tmpdir(), 'civicos-browser-build-'));
  const publicConfig = {
    VITE_AUTH0_DOMAIN: 'civicos-build-test.auth0.com',
    VITE_AUTH0_CLIENT_ID: 'build_test_client',
    VITE_SUPABASE_URL: 'https://civicos-build-test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_build_test',
  };
  const previous = Object.fromEntries(Object.keys(publicConfig).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, publicConfig);
    await build({ root, configFile: resolve(root, 'vite.config.js'), logLevel: 'silent', build: { outDir: dist, emptyOutDir: true } });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
test.afterAll(async () => { if (dist) await rm(dist, { recursive: true, force: true }); });

// Serve the actual production artifact at each origin through interception.
// No request reaches production, Auth0, Supabase, or paid external services.
async function serveBuild(page, origin) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      if (['/authorize', '/v2/logout', '/oidc/logout'].includes(url.pathname)) return route.fulfill({ contentType: 'text/html', body: '<p>Auth0 redirect captured by test</p>' });
      return route.abort();
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
    const path = resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(dist.endsWith(sep) ? dist : dist + sep)) return route.abort();
    try {
      const suffix = path.slice(path.lastIndexOf('.'));
      return route.fulfill({ body: await readFile(path), contentType: types[suffix] ?? 'text/html' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
}

for (const origin of ['http://localhost:5173', 'https://www.civicos.work']) {
  test(`built app preserves hash routes, UI, language switching and Auth0 redirect at ${origin}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await serveBuild(page, origin);
    await page.goto(`${origin}/#/`);
    await expect(page.getByRole('heading', { name: 'Available services' })).toBeVisible();
    await page.getByRole('searchbox').fill('gst');
    await expect(page.locator('article.card').filter({ hasText: 'GST/HST Credit' })).toBeVisible();
    await page.locator('.utilbar .lang-picker select').selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
    await page.locator('.utilbar .lang-picker select').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
    for (const route of ['housing', 'doctor', 'autism', 'alerts']) {
      await page.goto(`${origin}/#/${route}`);
      await page.reload();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main h1')).toBeVisible();
    }
    await page.goto(`${origin}/#/`);
    await page.getByRole('button', { name: /Guest Sign in or create an account/ }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/authorize');
    const authorization = new URL(page.url());
    expect(authorization.searchParams.get('redirect_uri')).toBe(origin);
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    // Exercise SDK logout after a denied verification callback, without a real login.
    const callback = new URL(origin);
    callback.searchParams.set('error', 'access_denied');
    callback.searchParams.set('error_description', 'CIVICOS_EMAIL_UNVERIFIED');
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    await page.goto(callback.href);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL((url) => ['/v2/logout', '/oidc/logout'].includes(url.pathname));
    const logout = new URL(page.url());
    expect(logout.searchParams.get('returnTo') ?? logout.searchParams.get('post_logout_redirect_uri')).toBe(origin);
    expect(errors).toEqual([]);
  });
}
