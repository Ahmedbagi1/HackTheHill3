import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { createApplicationRepository, readPersistenceConfig } from '../src/services/applicationRepository.ts';

// Only the transport and Auth0 SDK boundary are stubbed. These tests exercise
// the real Supabase JS client; this transport is never imported by the app.
const env = {
  VITE_SUPABASE_URL: 'https://civicos-client-test.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
  VITE_AUTH0_DOMAIN: 'civicos-client-test.auth0.com',
  VITE_AUTH0_CLIENT_ID: 'civicos_test_client',
};
const config = readPersistenceConfig(env);
const subject = 'auth0|client-test-a';
const health = { schema_version: 2, write_api_ready: true, supported_modules: ['service'] };
const payload = { answers: { fullName: 'Test applicant' }, consent: true, demoAcknowledged: true };
function saved(overrides = {}) {
  return {
    id: randomUUID(), reference_id: `CIV-${randomUUID().replaceAll('-', '').toUpperCase()}`,
    owner_issuer: config.issuer, owner_subject: subject, idempotency_key: randomUUID(),
    service_id: 'passport', module: 'service', title: 'Passport Services', category: 'identity',
    status: 'submitted', schema_version: 1, revision: 1, processing_mode: 'demo',
    submitted_payload: payload, payload, summary: [],
    submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...overrides,
  };
}
function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function harness(handler = () => response([])) {
  const calls = [];
  const state = {
    current: true, renewals: 0,
    claims: {
      __raw: 'test-signed-id-token', sub: subject, iss: config.issuer, aud: config.clientId,
      exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', email_verified: true,
    },
  };
  const session = {
    subject,
    isCurrentSession: () => state.current,
    refreshSession: async () => { state.renewals++; return 'opaque-userinfo-access-token'; },
    getIdTokenClaims: async () => state.claims,
  };
  const repository = createApplicationRepository(session, config, async (input, init) => {
    const call = { url: new URL(String(input)), init };
    calls.push(call);
    if (call.url.pathname.endsWith('/civicos_application_health')) return response(health);
    return handler(call, state);
  });
  return { repository, calls, state, session };
}

describe('Auth0-backed application client', () => {
  test('configuration accepts only public publishable keys and the required named environment variables', () => {
    assert.equal(config.url, env.VITE_SUPABASE_URL);
    assert.equal(config.issuer, `https://${env.VITE_AUTH0_DOMAIN}/`);
    for (const name of Object.keys(env)) assert.throws(() => readPersistenceConfig({ ...env, [name]: '' }), { code: 'CONFIGURATION' });
    for (const key of ['sb_secret_test', 'service-role-test', 'your-publishable-key']) {
      assert.throws(() => readPersistenceConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }), { code: 'CONFIGURATION' });
    }
    for (const url of ['http://remote.example.test', 'https://user:pass@example.test', 'https://example.test/?key=private', 'https://example.test/path']) {
      assert.throws(() => readPersistenceConfig({ ...env, VITE_SUPABASE_URL: url }), { code: 'CONFIGURATION' });
    }
  });

  test('uses the verified ID token, the publishable key and no-store for real Supabase requests', async () => {
    const row = saved();
    const h = harness(() => response([row]));
    assert.deepEqual(await h.repository.list(), { applications: [row], hasMore: false });
    // The SDK also obtains a token when it initializes its Realtime client.
    assert.ok(h.state.renewals >= 2);
    for (const { init } of h.calls) {
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-signed-id-token');
      assert.equal(new Headers(init.headers).get('apikey'), config.publishableKey);
      assert.equal(init.cache, 'no-store');
    }
    h.repository.dispose();
  });

  test('an empty verified database is distinct from a missing migration', async () => {
    const h = harness();
    assert.deepEqual(await h.repository.list(), { applications: [], hasMore: false });
    let calls = 0;
    const incomplete = createApplicationRepository(h.session, config, async () => {
      calls++;
      return response({ schema_version: 1, write_api_ready: false });
    });
    await assert.rejects(incomplete.list(), { code: 'MIGRATION_REQUIRED' });
    assert.equal(calls, 1);
    h.repository.dispose(); incomplete.dispose();
  });

  test('expired, unverified, wrong-account, wrong-role and missing ID tokens never reach the network', async () => {
    for (const overrides of [
      { __raw: '' }, { sub: 'auth0|other' }, { email_verified: false }, { role: 'anon' },
      { aud: 'wrong-client' }, { iss: 'https://wrong.auth0.com/' }, { exp: 1 },
    ]) {
      const h = harness();
      Object.assign(h.state.claims, overrides);
      await assert.rejects(h.repository.list(), { code: 'AUTH_REQUIRED' });
      assert.equal(h.calls.length, 0);
      h.repository.dispose();
    }
  });

  test('a renewed ID token and supported audience array are used without storing another session', async () => {
    const h = harness();
    h.state.claims.aud = ['another-audience', config.clientId];
    h.session.refreshSession = async () => { h.state.claims.__raw = 'renewed-test-id-token'; };
    await h.repository.list();
    assert.equal(new Headers(h.calls[0].init.headers).get('authorization'), 'Bearer renewed-test-id-token');
    h.repository.dispose();
  });

  test('logout and disposal prevent further reads or writes', async () => {
    const h = harness();
    h.state.current = false;
    await assert.rejects(h.repository.list(), { code: 'SESSION_CHANGED' });
    await assert.rejects(h.repository.submit('passport', payload, randomUUID()), { code: 'SESSION_CHANGED' });
    assert.equal(h.calls.length, 0);
    h.repository.dispose();
    h.state.current = true;
    await assert.rejects(h.repository.list(), { code: 'SESSION_CHANGED' });
  });

  test('a response arriving after logout is discarded even if its HTTP request completed', async () => {
    let release;
    let started;
    const pendingResponse = new Promise((resolve) => { release = resolve; });
    const requestStarted = new Promise((resolve) => { started = resolve; });
    const h = harness(() => { started(); return pendingResponse; });
    const pending = h.repository.list();
    await requestStarted;
    h.state.current = false;
    release(response([saved()]));
    await assert.rejects(pending, { code: 'SESSION_CHANGED' });
    h.repository.dispose();
  });

  test('account changes while Auth0 renews cannot send the previous account token', async () => {
    const h = harness();
    h.session.refreshSession = async () => { h.state.current = false; };
    await assert.rejects(h.repository.list(), { code: 'SESSION_CHANGED' });
    assert.equal(h.calls.length, 0);
    h.repository.dispose();
  });

  test('network failure never returns invented or browser-stored applications', async () => {
    const h = harness(() => { throw new TypeError('test network failure'); });
    await assert.rejects(h.repository.list(), { code: 'STORAGE_UNAVAILABLE' });
    await assert.rejects(h.repository.submit('passport', payload, randomUUID()), { code: 'STORAGE_UNAVAILABLE' });
    h.repository.dispose();
  });

  test('database errors are explicit and do not expose raw submitted values', async () => {
    for (const [dbCode, expected] of [
      ['PGRST202', 'MIGRATION_REQUIRED'], ['42501', 'AUTH_REQUIRED'],
      ['40001', 'CONFLICT'], ['23505', 'CONFLICT'], ['22023', 'VALIDATION'], ['P0002', 'NOT_FOUND'],
    ]) {
      const h = harness(() => response({ code: dbCode, message: 'raw-private-test-answer', details: 'raw-private-test-answer' }, 400));
      await assert.rejects(h.repository.submit('passport', payload, randomUUID()), (error) => {
        assert.equal(error.code, expected);
        assert.ok(!error.message.includes('raw-private-test-answer'));
        return true;
      });
      h.repository.dispose();
    }
  });

  test('submit sends full answers and a stable retry key; the returned ID comes from the database', async () => {
    const row = saved();
    const h = harness(() => response(row));
    const key = randomUUID();
    const first = await h.repository.submit('passport', payload, key);
    const repeated = await h.repository.submit('passport', payload, key);
    assert.equal(first.id, row.id);
    assert.equal(repeated.id, row.id);
    const writes = h.calls.filter((c) => c.url.pathname.endsWith('/submit_application'));
    assert.equal(writes.length, 2);
    for (const call of writes) {
      assert.equal(call.init.method, 'POST');
      assert.deepEqual(JSON.parse(call.init.body), {
        p_service_id: 'passport', p_payload: payload, p_idempotency_key: key, p_schema_version: 1,
      });
    }
    h.repository.dispose();
  });

  test('lifecycle sends the expected revision and operation key without direct table writes', async () => {
    const row = saved({ status: 'under_review', revision: 2 });
    const h = harness(() => response(row));
    const key = randomUUID();
    assert.equal((await h.repository.act(row.id, 1, 'start_review', key)).revision, 2);
    const call = h.calls.at(-1);
    assert.ok(call.url.pathname.endsWith('/apply_application_action'));
    assert.deepEqual(JSON.parse(call.init.body), {
      p_application_id: row.id, p_expected_revision: 1, p_action: 'start_review', p_operation_key: key, p_note: null,
    });
    h.repository.dispose();
  });

  test('ownership, malformed successes and missing response data cannot masquerade as saved applications', async () => {
    for (const body of [null, {}, saved({ owner_subject: 'auth0|other' }), saved({ reference_id: 'browser-generated' }), saved({ payload: {} })]) {
      const h = harness(() => response(body));
      await assert.rejects(h.repository.submit('passport', payload, randomUUID()), { code: 'INVALID_RESPONSE' });
      h.repository.dispose();
    }
  });

  test('list and history pagination do not silently truncate the records returned by Supabase', async () => {
    const rows = Array.from({ length: 21 }, () => saved());
    const h = harness(() => response(rows));
    const result = await h.repository.list(1);
    assert.equal(result.applications.length, 20);
    assert.equal(result.hasMore, true);
    assert.equal(h.calls.at(-1).url.searchParams.get('offset'), '20');
    assert.equal(h.calls.at(-1).url.searchParams.get('limit'), '21');
    const id = randomUUID();
    const events = Array.from({ length: 101 }, (_, index) => ({
      id: randomUUID(), application_id: id, application_revision: index + 1,
      from_status: null, to_status: 'submitted', source: 'submission', actor_subject: subject,
      note: null, created_at: new Date().toISOString(), operation_key: null, operation: null,
    }));
    const historyHarness = harness(() => response(events));
    const history = await historyHarness.repository.history(id);
    assert.equal(history.events.length, 100);
    assert.equal(history.hasMore, true);
    h.repository.dispose(); historyHarness.repository.dispose();
  });
});
