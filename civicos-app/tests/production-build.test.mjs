import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

test('production exposes only the four public identifiers, even when private keys are misnamed', async () => {
  const values = {
    VITE_AUTH0_DOMAIN: 'build-test.auth0.com',
    VITE_AUTH0_CLIENT_ID: 'build_test_public_client',
    VITE_SUPABASE_URL: 'https://build-test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_build_test_public',
    VITE_GEMINI_API_KEY: 'private_gemini_build_test_sentinel',
    VITE_UNRELATED_SECRET: 'private_unrelated_build_test_sentinel',
    VITE_AUTH0_DOMAIN_SECRET: 'private_prefix_collision_test_sentinel',
    ELEVENLABS_API_KEY: 'private_voice_build_test_sentinel',
    GEMINI_API_KEY: 'private_server_gemini_build_test_sentinel',
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const directory = await mkdtemp(join(tmpdir(), 'civicos-build-test-'));
  try {
    Object.assign(process.env, values);
    const entry = join(directory, 'entry.js');
    await writeFile(entry, `
      import { readPersistenceConfig } from ${JSON.stringify(resolve('src/services/applicationRepository.ts'))};
      globalThis.civicosBuildTest = { config: readPersistenceConfig(), env: import.meta.env };
    `);
    const result = await build({
      configFile: resolve('vite.config.js'), logLevel: 'silent',
      build: { write: false, rolldownOptions: { input: entry } },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
    const bundled = outputs.map((item) => item.type === 'chunk' ? item.code : String(item.source)).join('\n');
    for (const key of Object.keys(values).slice(0, 4)) assert.ok(bundled.includes(values[key]), `${key} must remain available`);
    for (const key of Object.keys(values).slice(4)) assert.ok(!bundled.includes(values[key]), `${key} must never enter browser output`);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
