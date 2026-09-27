import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// This is an in-memory PostgreSQL database, never the application database.
// The auth.jwt() shim supplies synthetic verified claims to exercise SQL/RLS.
// It does NOT verify Auth0 signatures or prove the live Supabase integration.
const issuer = 'https://civicos-policy-test.auth0.com/';
const clientId = 'civicos_policy_test_client';
const userA = 'auth0|policy-test-a';
const userB = 'auth0|policy-test-b';
const claimsFor = (subject, overrides = {}) => ({
  iss: issuer, aud: clientId, sub: subject,
  role: 'authenticated', email_verified: true,
  ...overrides,
});

let db;
let applicationA;
let applicationB;

async function asRole(role, claims, callback) {
  assert.ok(['anon', 'authenticated'].includes(role));
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await db.exec(`set local role ${role}`);
    return await callback();
  } finally {
    await db.exec('rollback');
  }
}

async function insertFixture(subject, fixtureIssuer = issuer) {
  const result = await db.query(`
    insert into public.applications
      (owner_issuer, owner_subject, idempotency_key, service_id, module, title,
       category, submitted_payload, payload)
    values ($1, $2, gen_random_uuid(), 'passport', 'service',
            'Test-only passport application', 'identity', $3, $3)
    returning *
  `, [fixtureIssuer, subject, JSON.stringify({ testOnly: true })]);
  const row = result.rows[0];
  await db.query(`
    insert into public.application_events
      (application_id, application_revision, to_status, source, actor_subject)
    values ($1, 1, 'submitted', 'submission', $2)
  `, [row.id, subject]);
  return row;
}

describe('application database foundation', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.jwt() returns jsonb language sql stable as
        $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.jwt() to anon, authenticated;
      -- Reproduce the broad default grants that existing Supabase projects may
      -- have, so tests prove the migration actually removes those permissions.
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    `);
    await db.exec(await readFile(new URL('../migrations/202609260001_application_foundation.sql', import.meta.url), 'utf8'));
    await db.query('insert into civicos_private.auth_configuration (issuer, client_id) values ($1, $2)', [issuer, clientId]);
    applicationA = await insertFixture(userA);
    applicationB = await insertFixture(userB);
    await insertFixture(userA, 'https://different-policy-test.auth0.com/');
  });

  after(async () => { await db?.close(); });

  test('database supplies UUIDs, unique references, timestamps, initial status and demo mode', () => {
    assert.match(applicationA.id, /^[a-f0-9-]{36}$/);
    assert.match(applicationA.reference_id, /^CIV-[A-F0-9]{32}$/);
    assert.notEqual(applicationA.reference_id, applicationB.reference_id);
    assert.equal(applicationA.status, 'submitted');
    assert.equal(applicationA.processing_mode, 'demo');
    assert.equal(applicationA.revision, 1);
    assert.equal(applicationA.schema_version, 1);
    assert.ok(Number.isFinite(new Date(applicationA.submitted_at).getTime()));
    assert.equal(+new Date(applicationA.submitted_at), +new Date(applicationA.updated_at));
  });

  test('both public tables have RLS enabled and only SELECT is granted to authenticated', async () => {
    const { rows } = await db.query(`
      select relname, relrowsecurity from pg_class
      where oid in ('public.applications'::regclass, 'public.application_events'::regclass)
    `);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.relrowsecurity));
    for (const table of ['applications', 'application_events']) {
      for (const role of ['anon', 'authenticated']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
          const result = await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, `public.${table}`, privilege]);
          assert.equal(result.rows[0].allowed, role === 'authenticated' && privilege === 'SELECT', `${role} ${privilege} ${table}`);
        }
      }
    }
  });

  test('User A and User B each read only their own persisted application and history', async () => {
    for (const [subject, own, other] of [[userA, applicationA, applicationB], [userB, applicationB, applicationA]]) {
      await asRole('authenticated', claimsFor(subject), async () => {
        const applications = await db.query('select id, payload from public.applications');
        assert.deepEqual(applications.rows.map((row) => row.id), [own.id]);
        assert.deepEqual(applications.rows[0].payload, { testOnly: true });
        assert.deepEqual((await db.query('select id from public.applications where id = $1', [other.id])).rows, []);
        const history = await db.query('select application_id from public.application_events');
        assert.deepEqual(history.rows.map((row) => row.application_id), [own.id]);
        assert.deepEqual((await db.query('select id from public.application_events where application_id = $1', [other.id])).rows, []);
      });
    }
  });

  test('verified accounts can read health, with writes explicitly marked unavailable', async () => {
    await asRole('authenticated', claimsFor(userA), async () => {
      const { rows } = await db.query('select public.civicos_application_health() as health');
      assert.deepEqual(rows[0].health, { schema_version: 1, write_api_ready: false });
    });
  });

  test('anonymous callers cannot read applications, history, or health', async () => {
    for (const query of [
      'select * from public.applications',
      'select * from public.application_events',
      'select public.civicos_application_health()',
    ]) {
      await assert.rejects(asRole('anon', {}, () => db.query(query)), { code: '42501' });
    }
  });

  test('missing/unverified/wrong-tenant/wrong-app/invalid identity claims reveal nothing', async () => {
    const invalid = [
      {},
      claimsFor(userA, { email_verified: false }),
      claimsFor(userA, { email_verified: 'true' }),
      claimsFor(userA, { email_verified: null }),
      claimsFor(userA, { iss: 'https://different-policy-test.auth0.com/' }),
      claimsFor(userA, { aud: 'another-client' }),
      claimsFor(userA, { aud: ['another-client'] }),
      claimsFor(userA, { aud: null }),
      claimsFor(userA, { role: 'service_role' }),
      claimsFor(''),
      claimsFor('   '),
      claimsFor(null),
      claimsFor(123),
      claimsFor('x'.repeat(256)),
    ];
    for (const claims of invalid) {
      await asRole('authenticated', claims, async () => {
        assert.deepEqual((await db.query('select id from public.applications')).rows, []);
        assert.deepEqual((await db.query('select id from public.application_events')).rows, []);
        await assert.rejects(db.query('select public.civicos_application_health()'), { code: '28000' });
      });
    }
  });

  test('audience arrays containing the configured SPA are supported', async () => {
    await asRole('authenticated', claimsFor(userA, { aud: [clientId, 'other-resource'] }), async () => {
      assert.deepEqual((await db.query('select id from public.applications')).rows, [{ id: applicationA.id }]);
    });
  });

  test('missing deployment configuration fails closed', async () => {
    await db.exec('begin');
    try {
      await db.exec('delete from civicos_private.auth_configuration');
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claimsFor(userA))]);
      await db.exec('set local role authenticated');
      assert.deepEqual((await db.query('select id from public.applications')).rows, []);
      await assert.rejects(db.query('select public.civicos_application_health()'), { code: '28000' });
    } finally {
      await db.exec('rollback');
    }
  });

  test('even owners cannot create, alter, delete or manufacture application history', async () => {
    const denied = [
      ["insert into public.applications (owner_issuer, owner_subject, idempotency_key, service_id, module, title, category, submitted_payload, payload) values ($1, $2, gen_random_uuid(), 'passport', 'service', 'Test', 'identity', '{}', '{}')", [issuer, userA]],
      ["update public.applications set status = 'completed' where id = $1", [applicationA.id]],
      ['update public.applications set owner_subject = $1 where id = $2', [userA, applicationB.id]],
      ['delete from public.applications where id = $1', [applicationA.id]],
      ["insert into public.application_events (application_id, application_revision, to_status, source, actor_subject) values ($1, 2, 'completed', 'demo_processing', $2)", [applicationA.id, userA]],
      ["update public.application_events set note = 'Fabricated history' where application_id = $1", [applicationA.id]],
      ['delete from public.application_events where application_id = $1', [applicationA.id]],
    ];
    for (const [sql, args] of denied) {
      await assert.rejects(asRole('authenticated', claimsFor(userA), () => db.query(sql, args)), { code: '42501' });
    }
  });

  test('a caller cannot read or rewrite the trusted Auth0 configuration', async () => {
    for (const sql of [
      'select * from civicos_private.auth_configuration',
      "update civicos_private.auth_configuration set client_id = 'attacker'",
      'delete from civicos_private.auth_configuration',
    ]) {
      await assert.rejects(asRole('authenticated', claimsFor(userA), () => db.query(sql)), { code: '42501' });
    }
  });

  test('same subject in another issuer is not the same owner', async () => {
    await asRole('authenticated', claimsFor(userA), async () => {
      const { rows } = await db.query('select owner_issuer from public.applications');
      assert.deepEqual(rows, [{ owner_issuer: issuer }]);
    });
  });

  test('idempotency keys cannot be reused for the same owner', async () => {
    await assert.rejects(db.query(`
      insert into public.applications
        (owner_issuer, owner_subject, idempotency_key, service_id, module, title, category, submitted_payload, payload)
      values ($1, $2, $3, 'passport', 'service', 'Test duplicate', 'identity', '{}', '{}')
    `, [issuer, userA, applicationA.idempotency_key]), { code: '23505' });
  });

  test('database constraints reject unknown services, statuses and invalid payload envelopes', async () => {
    for (const query of [
      "update public.applications set status = 'government-approved' where id = $1",
      "update public.applications set processing_mode = 'live-government' where id = $1",
      "update public.applications set service_id = 'unknown' where id = $1",
      "update public.applications set module = 'housing' where id = $1",
      "update public.applications set payload = '[]' where id = $1",
      "update public.applications set payload = jsonb_build_object('large', repeat('x', 65536)) where id = $1",
      "update public.applications set revision = 0 where id = $1",
      "update public.applications set updated_at = submitted_at - interval '1 day' where id = $1",
    ]) {
      await assert.rejects(db.query(query, [applicationA.id]), { code: '23514' });
    }
  });
});
