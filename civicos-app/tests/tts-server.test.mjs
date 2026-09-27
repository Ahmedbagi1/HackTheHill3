import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createTtsHandler, elevenLabsProxy } from '../server/elevenLabsProxy.js';

const origin = 'https://www.civicos.work';
const secret = 'private_voice_test_sentinel';
const mp3 = Buffer.from('ID3fake-mp3-bytes');

async function request(handler, { path = '/api/tts/speak', method = 'POST', body = JSON.stringify({ text: 'Hello.' }), parsed = false, headers = {} } = {}) {
  const req = Readable.from(parsed ? [] : [Buffer.from(body)]);
  req.url = path; req.method = method;
  req.headers = { origin, 'content-type': 'application/json', ...headers };
  if (parsed) req.body = body;
  const res = new EventEmitter();
  res.headers = {}; res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
  res.end = (value) => { res.payload = value; };
  await handler(req, res);
  const text = Buffer.isBuffer(res.payload) ? '' : String(res.payload ?? '');
  assert.ok(!text.includes(secret), 'response must not contain the key');
  return { status: res.statusCode, headers: res.headers, payload: res.payload, json: text ? JSON.parse(text) : null };
}

const upstreamOk = (calls = []) => async (url, init) => {
  calls.push({ url, init });
  return new Response(mp3, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
};

test('status is public and key-free; a missing key disables speech honestly', async () => {
  const handler = createTtsHandler({ apiKey: '', voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_multilingual_v2' });
  const status = await request(handler, { path: '/api/tts/status', method: 'GET' });
  assert.deepEqual(status.json, { enabled: false, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_multilingual_v2' });
  assert.equal((await request(handler)).status, 503);
  assert.equal((await request(handler, { path: '/api/tts/status' })).status, 405);
  assert.equal((await request(handler, { path: '/api/tts/other' })).status, 404);
});

test('speak sends the key only upstream and streams back MP3 audio', async () => {
  const calls = [];
  const handler = createTtsHandler({ apiKey: secret, fetchImpl: upstreamOk(calls) });
  const res = await request(handler, { body: JSON.stringify({ text: '  Bonjour.  ' }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'audio/mpeg');
  assert.deepEqual(res.payload, mp3);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/JBFqnCBsd6RMkjVDRZzb\?output_format=mp3_44100_128$/);
  assert.equal(calls[0].init.headers['xi-api-key'], secret);
  assert.deepEqual(JSON.parse(calls[0].init.body), { text: 'Bonjour.', model_id: 'eleven_multilingual_v2' });
});

test('Vercel-parsed bodies work; malformed, empty and oversized text never reach ElevenLabs', async () => {
  const calls = [];
  const handler = createTtsHandler({ apiKey: secret, fetchImpl: upstreamOk(calls) });
  assert.equal((await request(handler, { body: { text: 'Parsed.' }, parsed: true })).status, 200);
  for (const body of ['{', '{}', JSON.stringify({ text: '   ' }), JSON.stringify({ text: 'x'.repeat(5001) })]) {
    assert.ok([400, 413].includes((await request(handler, { body })).status), body.slice(0, 20));
  }
  for (const body of [null, [], 42]) assert.equal((await request(handler, { body, parsed: true })).status, 400);
  assert.equal((await request(handler, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal(calls.length, 1);
});

test('foreign origins and cross-site requests cannot spend voice credits', async () => {
  const calls = [];
  const handler = createTtsHandler({ apiKey: secret, fetchImpl: upstreamOk(calls) });
  for (const headers of [{ origin: 'https://attacker.example' }, { origin: undefined }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await request(handler, { headers })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test('upstream failures map to clear, key-free errors', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    for (const [status, expected, pattern] of [[401, 502, /API key was rejected/], [429, 429, /quota or rate limit/], [500, 502, /status 500/]]) {
      const handler = createTtsHandler({ apiKey: secret, fetchImpl: async () => new Response(`upstream said ${secret}`, { status }) });
      const res = await request(handler);
      assert.equal(res.status, expected);
      assert.match(res.json.error, pattern);
    }
    const empty = createTtsHandler({ apiKey: secret, fetchImpl: async () => new Response(Buffer.alloc(0), { status: 200 }) });
    assert.equal((await request(empty)).status, 502);
    const offline = createTtsHandler({ apiKey: secret, fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    assert.equal((await request(offline)).status, 502);
    const slow = createTtsHandler({ apiKey: secret, timeoutMs: 20, fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
    assert.equal((await request(slow)).status, 504);
  } finally { console.error = quiet; }
});

test('per-instance rate limit and malformed voice settings', async () => {
  const handler = createTtsHandler({ apiKey: secret, fetchImpl: upstreamOk(), maxRequests: 2 });
  assert.equal((await request(handler)).status, 200);
  assert.equal((await request(handler)).status, 200);
  assert.equal((await request(handler)).status, 429);
  const quiet = console.warn; console.warn = () => {};
  try {
    const bad = createTtsHandler({ apiKey: secret, voiceId: '../../admin', fetchImpl: upstreamOk() });
    assert.equal((await request(bad, { path: '/api/tts/status', method: 'GET' })).json.enabled, false);
    assert.equal((await request(bad)).status, 503);
  } finally { console.warn = quiet; }
});

test('local middleware keeps the legacy POST /api/tts route and passes other routes through', async () => {
  let handler;
  elevenLabsProxy({ apiKey: secret }).configureServer({ middlewares: { use(value) { handler = value; } } });
  let next = false;
  await handler({ url: '/api/gemini/status' }, {}, () => { next = true; });
  assert.equal(next, true);
  assert.equal((await request(handler, { path: '/api/tts', headers: { origin: 'https://www.civicos.work' } })).status, 403);
  assert.equal((await request(handler, { path: '/api/tts/status', method: 'GET' })).json.enabled, true);
});
