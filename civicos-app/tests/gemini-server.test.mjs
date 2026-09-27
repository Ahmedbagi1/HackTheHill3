import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { ApiError } from '@google/genai';
import { createGeminiHandler, GEMINI_MODEL, geminiProxy } from '../server/geminiProxy.js';

const origin = 'https://www.civicos.work';
const secret = 'private_gemini_test_sentinel';
const summary = { whoQualifies: 'Test eligibility.', documents: 'Test documents.', timeAndFees: 'Check the official site.' };
const input = { service: { title: 'GST/HST Credit' }, lang: 'en' };

async function request(handler, { path = '/api/gemini/simplify', method = 'POST', body = JSON.stringify(input), parsed = false, headers = {} } = {}) {
  const req = Readable.from(parsed ? [] : [Buffer.from(body)]);
  req.url = path; req.method = method;
  req.headers = { origin, 'content-type': 'application/json', ...headers };
  if (parsed) req.body = body;
  const res = new (await import('node:events')).EventEmitter();
  res.headers = {}; res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
  res.end = (value) => { res.text = value; res.writableFinished = true; };
  await handler(req, res);
  assert.ok(!res.text?.includes(secret), 'response must not contain key');
  return { status: res.statusCode, headers: res.headers, body: JSON.parse(res.text) };
}
const configured = (options = {}) => createGeminiHandler({ apiKey: secret, generateContent: async () => ({ text: JSON.stringify(summary) }), ...options });

test('status is public, key-free, GET-only; missing key fails honestly', async () => {
  const handler = createGeminiHandler({ apiKey: '' });
  assert.deepEqual((await request(handler, { path: '/api/gemini/status', method: 'GET' })).body, { enabled: false, model: GEMINI_MODEL });
  assert.equal((await request(handler)).status, 503);
  assert.equal((await request(handler, { path: '/api/gemini/status' })).status, 405);
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  assert.equal((await request(handler, { path: '/api/gemini/constructor' })).status, 404);
});

test('local middleware shares the handler and passes unrelated routes through', async () => {
  let handler;
  geminiProxy({ apiKey: '' }).configureServer({ middlewares: { use(value) { handler = value; } } });
  let next = false;
  await handler({ url: '/api/feeds/news' }, {}, () => { next = true; });
  assert.equal(next, true);
  assert.equal((await request(handler, { headers: { origin: 'http://localhost:5173' } })).status, 503);
});

test('foreign or missing Origin, cross-site requests and non-JSON content never call Gemini', async () => {
  let calls = 0;
  const handler = configured({ generateContent: async () => { calls++; } });
  for (const headers of [{ origin: 'https://attacker.example' }, { origin: undefined }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await request(handler, { headers })).status, 403);
  }
  assert.equal((await request(handler, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal(calls, 0);
});

test('raw and Vercel-parsed malformed or oversized bodies are rejected before upstream calls', async () => {
  let calls = 0;
  const handler = configured({ generateContent: async () => { calls++; } });
  for (const body of ['{', 'null', '[]', '"text"', '{}']) assert.equal((await request(handler, { body })).status, 400);
  for (const body of [null, [], {}, 42]) assert.equal((await request(handler, { body, parsed: true })).status, 400);
  assert.equal((await request(handler, { body: 'a'.repeat(65537) })).status, 413);
  assert.equal((await request(handler, { body: { text: 'a'.repeat(65537) }, parsed: true })).status, 413);
  assert.equal((await request(handler, { headers: { 'content-length': '65537' } })).status, 413);
  assert.equal(calls, 0);
});

test('all three tasks use fixed model, bounded output, timeout and no SDK retries', async () => {
  const cases = [
    ['simplify', input, summary],
    ['triage', { query: 'I lost my job recently', catalog: [{ id: 'gst', title: 'GST credit' }] }, { guidance: 'Check this service.', urgency: 'Standard', recommendedServiceIds: ['gst'], actionPlan: [{ title: 'Review eligibility.', serviceId: 'gst' }] }],
    ['extract', { text: 'My name is Test Person', fields: [{ name: 'fullName', label: 'Full name', type: 'text' }] }, { fullName: 'Test Person' }],
  ];
  for (const [task, body, output] of cases) {
    const handler = configured({ generateContent: async (options) => {
      assert.equal(options.model, GEMINI_MODEL);
      assert.equal(options.config.maxOutputTokens, 2048);
      assert.equal(options.config.httpOptions.retryOptions.attempts, 1);
      assert.ok(options.config.abortSignal instanceof AbortSignal);
      assert.ok(!JSON.stringify(options).includes(secret));
      return { text: JSON.stringify(output) };
    } });
    const result = await request(handler, { path: `/api/gemini/${task}`, parsed: true, body });
    assert.equal(result.status, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(result.body, task === 'extract' ? { values: output } : output);
  }
});

test('invalid model JSON, missing fields, unknown output fields and empty output fail safely', async () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...summary, leaked: secret })]) {
    const result = await request(configured({ generateContent: async () => ({ text }) }));
    assert.equal(result.status, 502); assert.equal(result.body.code, 'INVALID_RESPONSE');
  }
  const empty = await request(configured({ generateContent: async () => ({}) }));
  assert.equal(empty.status, 502); assert.equal(empty.body.code, 'EMPTY');
});

test('upstream errors and rate limits never echo or log raw provider messages', async () => {
  for (const error of [new Error(secret), new ApiError({ message: secret, status: 429 }), new ApiError({ message: secret, status: 500 })]) {
    const result = await request(configured({ generateContent: async () => { throw error; } }));
    assert.equal(result.status, error.status === 429 ? 429 : 502);
    if (result.status === 429) assert.equal(result.headers['retry-after'], '60');
  }
});

test('hung upstream has a bounded timeout and releases its concurrency slot', async () => {
  let signal;
  let calls = 0;
  const handler = configured({ timeoutMs: 10, maxConcurrent: 1, generateContent: ({ config }) => {
    if (++calls > 1) return Promise.resolve({ text: JSON.stringify(summary) });
    signal = config.abortSignal; return new Promise(() => {});
  } });
  const result = await request(handler);
  assert.equal(result.status, 504); assert.equal(signal.aborted, true);
  assert.equal((await request(handler)).status, 200);
});

test('per-instance request budget resets; concurrent calls cannot exceed the cap', async () => {
  let clock = 0;
  const handler = configured({ maxRequests: 1, now: () => clock });
  assert.equal((await request(handler)).status, 200);
  assert.equal((await request(handler)).status, 429);
  clock = 60_000;
  assert.equal((await request(handler)).status, 200);
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const concurrent = configured({ maxConcurrent: 1, generateContent: () => new Promise((resolve) => { release = resolve; started(); }) });
  const first = request(concurrent);
  await ready;
  assert.equal((await request(concurrent)).status, 429);
  release({ text: JSON.stringify(summary) });
  assert.equal((await first).status, 200);
});

test('real Vercel entrypoint works over local HTTP and passes runtime key only to Google SDK', async () => {
  const previous = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = secret;
  let upstreamCalls = 0;
  globalThis.fetch = async (resource, init) => {
    const req = new Request(resource, init);
    assert.equal(new URL(req.url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(req.headers.get('x-goog-api-key'), secret);
    upstreamCalls++;
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(summary) }] }, finishReason: 'STOP' }] });
  };
  const { default: adapter } = await import(`../api/gemini/[task].js?test=${Date.now()}`);
  const server = createServer(adapter);
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/gemini`;
    const status = await originalFetch(`${base}/status`);
    assert.deepEqual(await status.json(), { enabled: true, model: GEMINI_MODEL });
    const response = await originalFetch(`${base}/simplify`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), summary);
    assert.equal(upstreamCalls, 1);
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  }
});

test('triage passes chat history as citizen data and constrains wizard branch options', async () => {
  let seen;
  const answer = { guidance: 'File a T2.', urgency: 'High', recommendedServiceIds: ['ltb'], actionPlan: [{ title: 'Start a T2.', serviceId: 'ltb', option: 'T2' }] };
  const handler = createGeminiHandler({ apiKey: secret, generateContent: async (input) => { seen = input; return { text: JSON.stringify(answer) }; } });
  const body = JSON.stringify({
    query: 'They also shut off the water.',
    history: ['My landlord will not fix the heat.', 42],
    catalog: [{ id: 'ltb', title: 'Landlord and Tenant Board', options: [{ value: 'T2', label: 'Tenant rights' }, { value: 'T6', label: 'Maintenance' }, { value: 'bad value!', label: 'x' }] }],
  });
  const res = await request(handler, { path: '/api/gemini/triage', body });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, answer);
  assert.match(seen.contents, /<citizen_input>\n<earlier_messages>\nMy landlord will not fix the heat\.\n<\/earlier_messages>\nThey also shut off the water\.\n<\/citizen_input>/);
  assert.match(seen.contents, /\[options: T2 = Tenant rights; T6 = Maintenance\]/);
  // Ids and options are enforced after generation; enums in the schema make Gemini time out.
  assert.equal(seen.config.responseSchema.properties.recommendedServiceIds.items.enum, undefined);

  const invented = createGeminiHandler({ apiKey: secret, generateContent: async () => ({ text: JSON.stringify({
    ...answer,
    recommendedServiceIds: ['ltb', 'invented', 'ltb'],
    actionPlan: [{ title: 'Wrong branch', serviceId: 'ltb', option: 'T9' }, { title: 'Unknown service', serviceId: 'invented', option: 'T2' }],
  }) }) });
  assert.deepEqual((await request(invented, { path: '/api/gemini/triage', body })).body, {
    ...answer,
    recommendedServiceIds: ['ltb'],
    actionPlan: [{ title: 'Wrong branch', serviceId: 'ltb' }, { title: 'Unknown service' }],
  });
});

test('a slow or failed Gemini call is hedged by one identical call; the first answer wins', async () => {
  const never = (input) => new Promise((_, reject) => input.config.abortSignal.addEventListener('abort', () => reject(new Error('aborted'))));
  let calls = 0; const aborted = [];
  const slowFirst = configured({ hedgeDelayMs: 20, generateContent: async (input) => {
    calls++;
    if (calls === 1) { input.config.abortSignal.addEventListener('abort', () => aborted.push(1)); return never(input); }
    return { text: JSON.stringify(summary) };
  } });
  assert.equal((await request(slowFirst)).status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(aborted, [1], 'the losing call is cancelled');

  calls = 0;
  const failsOnce = configured({ hedgeDelayMs: 10_000, generateContent: async () => {
    if (++calls === 1) throw new ApiError({ message: 'unavailable', status: 503 });
    return { text: JSON.stringify(summary) };
  } });
  assert.equal((await request(failsOnce)).status, 200);
  assert.equal(calls, 2);

  calls = 0;
  const quota = configured({ hedgeDelayMs: 10_000, generateContent: async () => { calls++; throw new ApiError({ message: 'quota', status: 429 }); } });
  assert.equal((await request(quota)).status, 429);
  assert.equal(calls, 1, 'client errors are not retried');

  calls = 0;
  const bothSlow = configured({ hedgeDelayMs: 10, timeoutMs: 60, generateContent: (input) => { calls++; return never(input); } });
  assert.equal((await request(bothSlow)).status, 504);
  assert.equal(calls, 2);
});
