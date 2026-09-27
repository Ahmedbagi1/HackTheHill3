import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callGeminiTask, GeminiError } from '../src/services/api/gemini/geminiClient.js';

test('frontend calls only its own API and sends no key', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/gemini/simplify');
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(options.body), { service: { title: 'Test' } });
    return Response.json({ whoQualifies: 'Test' });
  });
  assert.deepEqual(await callGeminiTask('simplify', { service: { title: 'Test' } }), { whoQualifies: 'Test' });
});

test('HTML firewall errors and unsafe response bodies never reach UI messages', async (t) => {
  for (const [status, code] of [[429, 'RATE_LIMITED'], [503, 'DISABLED'], [403, 'BAD_REQUEST'], [502, 'UPSTREAM'], [504, 'UPSTREAM']]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private-upstream-secret', { status }));
    await assert.rejects(callGeminiTask('triage', {}), (error) => error instanceof GeminiError && error.code === code && !error.message.includes('private-upstream-secret'));
    mock.mock.restore();
  }
});

test('malformed successes, network errors and cancellation are distinguishable', async (t) => {
  for (const value of [[], null, 'string']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    await assert.rejects(callGeminiTask('triage', {}), { code: 'INVALID_RESPONSE' });
    mock.mock.restore();
  }
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('private detail'); });
  await assert.rejects(callGeminiTask('extract', {}), { code: 'NETWORK' });
  network.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('cancelled', 'AbortError'); });
  await assert.rejects(callGeminiTask('extract', {}), { name: 'AbortError' });
});
