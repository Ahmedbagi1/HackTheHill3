import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.mjs', workers: 1,
  timeout: 60000, reporter: 'list',
  use: { channel: 'chrome', headless: true, viewport: { width: 1280, height: 900 }, trace: 'off' },
});
