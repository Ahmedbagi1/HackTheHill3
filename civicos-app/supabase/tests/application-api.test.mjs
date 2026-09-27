import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { definitionSql, readServiceDefinitions } from '../../scripts/service-definitions.mjs';
import { buildApplicationApiSql } from '../../scripts/prepare-application-api.mjs';

// Synthetic test fixtures run only in in-memory PostgreSQL. They are never
// shipped to the browser or inserted into the live Supabase project.
const issuer = 'https://civicos-api-test.auth0.com/';
const clientId = 'civicos_api_test_client';
const userA = 'auth0|api-test-a';
const userB = 'auth0|api-test-b';
const claimsFor = (sub = userA, overrides = {}) => ({
  iss: issuer, aud: clientId, sub, role: 'authenticated', email_verified: true, ...overrides,
});
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
const sampleLocation = { lat: 45.4, lon: -75.7, accuracy: 10, label: 'Test location' };
const sampleWaste = {
  lat: 45.4, lon: -75.7, address: 'Test address', displayName: 'Test address',
  day: 'MONDAY', zone: 'Central', schedule: 'A', scheduleCode: 'A',
  multiResidential: false, contractor: 'Test contractor', nextCollection: today(),
  rotation: [{ stream: 'Recycling', frequency: 'Test schedule' }],
};
const patternedValues = {
  passportNumber: 'AB123456', postalCode: 'K1P 1J1', accessCode: '1234', uci: '12345678',
  licenceNumber: 'A1234-12345-12345', plateNumber: 'TEST123', plate: 'TEST123',
  vin: 'TESTTESTTEST12345', healthNumber: '1234 567 890', email: 'demo@example.test',
  phone: '6135550123', emergencyPhone: '6135550123', waterAccount: '123456',
  ticketNumber: 'TEST123', microchipNumber: '123456789', prestoNumber: '12345678901234567',
};
let db;
let definitions;
let verification;

function payloadFor(serviceId, overrides = {}) {
  const definition = definitions.find((s) => s.id === serviceId);
  const answers = Object.fromEntries(definition.fields.map((f) => {
    let value;
    if (f.pattern) {
      value = patternedValues[f.name];
      assert.ok(value && new RegExp(f.pattern, f.insensitive ? 'i' : '').test(value), f.name);
    } else if (f.rule === 'sin') value = '123 456 782';
    else if (f.rule === 'roll-number') value = '0614 000 000 00000 0000';
    else if (f.type === 'checkbox') value = true;
    else if (f.type === 'checkbox-group') value = [f.options[0].value];
    else if (f.options) value = f.options[0].value;
    else if (f.type === 'date') value = f.notBeforeToday ? today() : '1990-01-01';
    else if (f.type === 'number') value = String(Math.min(f.max ?? Infinity, Math.max(f.min ?? 0, 1)));
    else if (f.type === 'geotag') value = sampleLocation;
    else if (f.type === 'waste-lookup') value = sampleWaste;
    else value = 'Test input';
    return [f.name, value];
  }));
  return { answers: { ...answers, ...overrides }, consent: true, demoAcknowledged: true };
}

async function asUser(callback, claims = claimsFor(), role = 'authenticated') {
  assert.ok(['anon', 'authenticated'].includes(role));
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return callback(tx);
  });
}
async function submit(serviceId = 'passport', payload = payloadFor(serviceId), key = randomUUID(), claims = claimsFor(), version = 1) {
  return asUser(async (tx) => (await tx.query(
    'select public.submit_application($1, $2, $3, $4) as application',
    [serviceId, JSON.stringify(payload), key, version],
  )).rows[0].application, claims);
}
async function action(application, name, { key = randomUUID(), note = null, claims = claimsFor() } = {}) {
  return asUser(async (tx) => (await tx.query(
    'select public.apply_application_action($1, $2, $3, $4, $5) as application',
    [application.id, application.revision, name, key, note],
  )).rows[0].application, claims);
}
async function history(application, claims = claimsFor()) {
  return asUser(async (tx) => (await tx.query(
    'select * from public.application_events where application_id = $1 order by application_revision', [application.id],
  )).rows, claims);
}

describe('application submission and lifecycle API', () => {
  before(async () => {
    definitions = await readServiceDefinitions();
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.jwt() returns jsonb language sql stable as
        $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.jwt() to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    `);
    await db.exec(await readFile(new URL('../migrations/202609260001_application_foundation.sql', import.meta.url), 'utf8'));
    await db.query('insert into civicos_private.auth_configuration (issuer, client_id) values ($1, $2)', [issuer, clientId]);
    verification = (await db.exec(await buildApplicationApiSql())).at(-1).rows[0];
  });
  after(async () => { await db?.close(); });

  test('the complete manual SQL bundle applies atomically, verifies readiness and inserts no application data', async () => {
    assert.deepEqual(verification, {
      applications_rls: true, history_rls: true, auth0_configured: true,
      submit_rpc_ready: true, lifecycle_rpc_ready: true, supported_service_count: 29, direct_writes_blocked: true,
    });
    assert.equal((await db.query('select count(*) from public.applications')).rows[0].count, 0);
  });

  test('SQL definitions match all 29 existing forms without changing their choices or conditions', async () => {
    assert.equal(definitions.length, 29);
    assert.equal(await readFile(new URL('../migrations/202609260002_service_definitions.sql', import.meta.url), 'utf8'), definitionSql(definitions));
    for (const { id, ...definition } of definitions) {
      const result = await db.query('select civicos_private.service_definition($1) as definition', [id]);
      assert.deepEqual(result.rows[0].definition, definition);
    }
  });

  test('each existing service persists full visible answers, ownership, IDs and a matching initial event', async () => {
    for (const definition of definitions) {
      const payload = payloadFor(definition.id);
      const application = await submit(definition.id, payload);
      assert.equal(application.owner_subject, userA);
      assert.equal(application.owner_issuer, issuer);
      assert.equal(application.title, definition.title);
      assert.equal(application.category, definition.category);
      assert.equal(application.status, 'submitted');
      assert.equal(application.processing_mode, 'demo');
      assert.match(application.id, /^[0-9a-f-]{36}$/);
      assert.match(application.reference_id, /^CIV-[0-9A-F]{32}$/);
      assert.deepEqual(application.payload, application.submitted_payload);
      for (const field of definition.fields) {
        const visible = !field.conditions || field.conditions.every((c) => c.values.includes(payload.answers[c.name]));
        assert.equal(Object.hasOwn(application.payload.answers, field.name), visible, `${definition.id}.${field.name}`);
        if (visible) assert.deepEqual(application.payload.answers[field.name], payload.answers[field.name]);
      }
      const events = await history(application);
      assert.equal(events.length, 1);
      assert.equal(events[0].application_revision, 1);
      assert.equal(events[0].actor_subject, userA);
      assert.equal(events[0].to_status, 'submitted');
      assert.equal(events[0].from_status, null);
    }
  });

  test('conditional branches accept existing form options, including compound EI conditions', async () => {
    for (const service of definitions) {
      const branches = service.fields.filter((field) => field.conditions);
      for (const branch of branches) {
        const overrides = Object.fromEntries(branch.conditions.map((c) => [c.name, c.values[0]]));
        const payload = payloadFor(service.id, overrides);
        const saved = await submit(service.id, payload);
        assert.deepEqual(saved.payload.answers[branch.name], payload.answers[branch.name], `${service.id}.${branch.name}`);
      }
    }
    const saved = await submit('employment-insurance', payloadFor('employment-insurance', { requestType: 'report', workedDuringPeriod: 'no' }));
    assert.ok(!Object.hasOwn(saved.payload.answers, 'periodEarnings'));
  });

  test('health advertises only the service module supported at this checkpoint', async () => {
    const result = await asUser((tx) => tx.query('select public.civicos_application_health() as health'));
    assert.deepEqual(result.rows[0].health, { schema_version: 2, write_api_ready: true, supported_modules: ['service'] });
  });

  test('idempotent submissions retry safely, reject changed answers and scope keys to the account', async () => {
    const key = randomUUID();
    const original = await submit('passport', payloadFor('passport'), key);
    const repeated = await submit('passport', payloadFor('passport'), key);
    assert.equal(repeated.id, original.id);
    assert.equal((await history(original)).length, 1);
    await assert.rejects(submit('passport', payloadFor('passport', { fullName: 'Changed test name' }), key), { code: '23505' });
    await assert.rejects(submit('osap', payloadFor('osap'), key), { code: '23505' });
    const otherOwner = await submit('passport', payloadFor('passport'), key, claimsFor(userB));
    assert.notEqual(otherOwner.id, original.id);
  });

  test('untrusted ownership/status fields, unsupported modules and malformed envelopes are rejected', async () => {
    for (const payload of [
      null, [], {}, { answers: [] },
      { ...payloadFor('passport'), consent: false },
      { ...payloadFor('passport'), demoAcknowledged: 'true' },
      { ...payloadFor('passport'), owner_subject: userB },
      { ...payloadFor('passport'), status: 'completed' },
      payloadFor('passport', { unexpected: true }),
      payloadFor('passport', { fullName: 'x'.repeat(66000) }),
    ]) await assert.rejects(submit('passport', payload), { code: '22023' });
    for (const id of [null, 'unknown', 'housing', 'doctor', 'autism']) {
      await assert.rejects(submit(id, payloadFor('passport')), { code: '22023' });
    }
    await assert.rejects(submit('passport', payloadFor('passport'), null), { code: '22023' });
    await assert.rejects(submit('passport', payloadFor('passport'), randomUUID(), claimsFor(), 2), { code: '22023' });
  });

  test('required, choice, type, length, date, number and custom rules fail before any insert', async () => {
    const cases = [
      ['passport', { fullName: '' }], ['passport', { fullName: {} }], ['passport', { fullName: 'x'.repeat(501) }],
      ['passport', { requestType: 'not-a-choice' }], ['passport', { dateOfBirth: '2025-02-30' }],
      ['passport', { dateOfBirth: '2999-01-01' }], ['passport', { passportNumber: 'bad' }],
      ['canada-child-benefit', { childrenUnder6: '0', children6to17: '0' }],
      ['canada-child-benefit', { childrenUnder6: '1.5' }], ['canada-child-benefit', { childrenUnder6: '13' }],
      ['canada-child-benefit', { afni: '-1' }], ['canada-child-benefit', { afni: 'NaN' }],
      ['canada-child-benefit', { afni: 100 }], ['canada-child-benefit', { afni: '1e999' }],
      ['osap', { sin: '123456789' }], ['voter-registration', { dateOfBirth: today() }],
      ['voter-registration', { citizen: 'true' }], ['property-tax-water', { rollNumber: '123' }],
      ['police-report', { incidentGeotag: { ...sampleLocation, lat: 91 } }],
      ['police-report', { incidentGeotag: { ...sampleLocation, label: {} } }],
      ['waste-collection', { wasteSchedule: { ...sampleWaste, rotation: 'not-array' } }],
      ['waste-collection', { wasteSchedule: { ...sampleWaste, address: {} } }],
      ['waste-collection', { wasteSchedule: { ...sampleWaste, injected: true } }],
    ];
    const beforeCount = (await db.query('select count(*) from public.applications')).rows[0].count;
    for (const [service, overrides] of cases) {
      await assert.rejects(submit(service, payloadFor(service, overrides)), { code: '22023' }, `${service}: ${Object.keys(overrides)}`);
    }
    assert.equal((await db.query('select count(*) from public.applications')).rows[0].count, beforeCount);
  });

  test('checkbox groups reject invalid choices, duplicate choices and scalar values', async () => {
    const service = definitions.find((s) => s.fields.some((f) => f.type === 'checkbox-group' && !f.conditions));
    const field = service.fields.find((f) => f.type === 'checkbox-group' && !f.conditions);
    for (const value of ['no', ['invented'], [field.options[0].value, field.options[0].value]]) {
      await assert.rejects(submit(service.id, payloadFor(service.id, { [field.name]: value })), { code: '22023' });
    }
  });

  test('whitespace cannot bypass conditional required fields and hidden answers are discarded', async () => {
    await assert.rejects(submit('passport', payloadFor('passport', { requestType: ' renewal ', passportNumber: '' })), { code: '22023' });
    const saved = await submit('passport', payloadFor('passport', { requestType: ' renewal ' }));
    assert.equal(saved.payload.answers.requestType, 'renewal');
    assert.equal(saved.payload.answers.passportNumber, 'AB123456');
    assert.ok(!Object.hasOwn(saved.payload.answers, 'guarantorName'));
  });

  test('submission and event insertion are atomic when history fails', async () => {
    const key = randomUUID();
    await db.exec(`
      create function public.test_fail_event() returns trigger language plpgsql as
        $$ begin raise exception 'Test-only event failure'; end $$;
      create trigger test_fail_event before insert on public.application_events for each row execute function public.test_fail_event();
    `);
    try {
      await assert.rejects(submit('passport', payloadFor('passport'), key), /Test-only event failure/);
      assert.equal((await db.query('select count(*) from public.applications where idempotency_key = $1', [key])).rows[0].count, 0);
    } finally {
      await db.exec('drop trigger test_fail_event on public.application_events; drop function public.test_fail_event()');
    }
  });

  test('a full prototype lifecycle persists every transition and response without changing original answers', async () => {
    let saved = await submit();
    const originalPayload = saved.submitted_payload;
    const key = randomUUID();
    const original = saved;
    saved = await action(saved, 'start_review', { key });
    assert.equal((await action(original, 'start_review', { key })).revision, 2);
    await assert.rejects(action(original, 'start_review'), { code: '40001' });
    await assert.rejects(action(original, 'request_information', { key }), { code: '23505' });
    saved = await action(saved, 'request_information');
    saved = await action(saved, 'respond', { note: '  Additional test details.  ' });
    saved = await action(saved, 'complete');
    assert.equal(saved.status, 'completed');
    assert.equal(saved.revision, 5);
    assert.deepEqual(saved.submitted_payload, originalPayload);
    assert.deepEqual(saved.payload, originalPayload);
    assert.ok(new Date(saved.updated_at) >= new Date(saved.submitted_at));
    const events = await history(saved);
    assert.deepEqual(events.map((e) => e.to_status), ['submitted', 'under_review', 'needs_information', 'under_review', 'completed']);
    assert.deepEqual(events.map((e) => e.source), ['submission', 'demo_processing', 'demo_processing', 'user_response', 'demo_processing']);
    assert.equal(events[3].note, 'Additional test details.');
    await assert.rejects(action(saved, 'withdraw'), { code: '22023' });
    assert.equal((await history(saved)).length, 5);
    assert.equal((await submit('passport', payloadFor('passport'), saved.idempotency_key)).status, 'completed');
  });

  test('rejection and withdrawal are terminal, persisted records rather than deletions', async () => {
    const submitted = await submit();
    await assert.rejects(action(submitted, 'complete'), { code: '22023' });
    await assert.rejects(action(submitted, 'reject'), { code: '22023' });
    const rejected = await action(await action(submitted, 'start_review'), 'reject');
    assert.equal(rejected.status, 'rejected');
    await assert.rejects(action(rejected, 'start_review'), { code: '22023' });
    const withdrawn = await action(await submit(), 'withdraw');
    assert.equal(withdrawn.status, 'withdrawn');
    assert.equal((await history(withdrawn)).length, 2);
    await assert.rejects(action(withdrawn, 'start_review'), { code: '22023' });
  });

  test('responses require bounded notes and retries cannot change a saved response', async () => {
    const submitted = await submit();
    await assert.rejects(action(submitted, 'respond', { note: 'Test response' }), { code: '22023' });
    await assert.rejects(action(submitted, 'start_review', { note: 'Forged review note' }), { code: '22023' });
    const waiting = await action(await action(submitted, 'start_review'), 'request_information');
    for (const note of [null, '', '   ', 'x'.repeat(2001)]) {
      await assert.rejects(action(waiting, 'respond', { note }), { code: '22023' });
    }
    const key = randomUUID();
    await action(waiting, 'respond', { key, note: 'Test response' });
    assert.equal((await action(waiting, 'respond', { key, note: 'Test response' })).revision, 4);
    await assert.rejects(action(waiting, 'respond', { key, note: 'Changed response' }), { code: '23505' });
  });

  test('status and revision roll back if the corresponding history insert fails', async () => {
    const saved = await submit();
    await db.exec(`
      create function public.test_fail_event() returns trigger language plpgsql as
        $$ begin raise exception 'Test-only event failure'; end $$;
      create trigger test_fail_event before insert on public.application_events for each row execute function public.test_fail_event();
    `);
    try {
      await assert.rejects(action(saved, 'start_review'), /Test-only event failure/);
      const result = await asUser((tx) => tx.query('select status, revision from public.applications where id = $1', [saved.id]));
      assert.deepEqual(result.rows, [{ status: 'submitted', revision: 1 }]);
    } finally {
      await db.exec('drop trigger test_fail_event on public.application_events; drop function public.test_fail_event()');
    }
  });

  test('User B cannot read or change User A data even with a guessed ID and operation key', async () => {
    const own = await submit();
    const otherClaims = claimsFor(userB);
    const result = await asUser((tx) => tx.query('select * from public.applications where id = $1', [own.id]), otherClaims);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(await history(own, otherClaims), []);
    await assert.rejects(action(own, 'start_review', { key: own.idempotency_key, claims: otherClaims }), { code: 'P0002' });
    await assert.rejects(action({ id: randomUUID(), revision: 1 }, 'start_review', { claims: otherClaims }), { code: 'P0002' });
  });

  test('anonymous, wrong-tenant, wrong-app and unverified callers cannot invoke writes', async () => {
    const saved = await submit();
    for (const claims of [
      {}, claimsFor(userA, { email_verified: false }), claimsFor(userA, { email_verified: 'true' }),
      claimsFor(userA, { iss: 'https://wrong.auth0.com/' }), claimsFor(userA, { aud: 'wrong' }),
      claimsFor(userA, { role: 'anon' }), claimsFor(userA, { sub: '' }),
    ]) {
      await assert.rejects(submit('passport', payloadFor('passport'), randomUUID(), claims), { code: '28000' });
      await assert.rejects(action(saved, 'start_review', { claims }), { code: '28000' });
    }
    await assert.rejects(asUser((tx) => tx.query('select public.submit_application($1, $2, $3)', ['passport', JSON.stringify(payloadFor('passport')), randomUUID()]), {}, 'anon'), { code: '42501' });
    await assert.rejects(asUser((tx) => tx.query('select public.apply_application_action($1, 1, $2, $3)', [saved.id, 'start_review', randomUUID()]), {}, 'anon'), { code: '42501' });
  });

  test('new RPCs keep direct table mutations and private helpers unavailable to browsers', async () => {
    const saved = await submit();
    for (const sql of [
      'delete from public.applications', "update public.applications set status = 'completed'",
      "insert into public.applications (owner_subject) values ('forged')",
      'delete from public.application_events', "update public.application_events set note = 'forged'",
      "select civicos_private.service_definition('passport')",
      "select civicos_private.validate_service_payload('{}', '{}', current_date)",
    ]) await assert.rejects(asUser((tx) => tx.exec(sql)), { code: '42501' });
    assert.equal((await history(saved)).length, 1);
    const result = await db.query(`select proname, prosecdef, proconfig from pg_proc
      where oid in ('public.submit_application(text,jsonb,uuid,integer)'::regprocedure,
                    'public.apply_application_action(uuid,integer,text,uuid,text)'::regprocedure)`);
    assert.equal(result.rows.length, 2);
    assert.ok(result.rows.every((p) => p.prosecdef && p.proconfig.includes('search_path=""')));
  });
});
