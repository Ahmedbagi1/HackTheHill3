/**
 * Text-to-speech client. Talks to the local /api/tts proxy
 * (server/elevenLabsProxy.js) which holds the ElevenLabs API key.
 * When the proxy isn't available (static hosting, no key), callers fall back
 * to the browser's speechSynthesis voice.
 */

let statusPromise = null;
const audioCache = new Map();

/** Resolves to { enabled, voiceId, modelId }; cached for the session. */
export function getVoiceStatus() {
  statusPromise ??= fetch("/api/tts/status")
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((status) => ({ enabled: Boolean(status?.enabled), voiceId: status?.voiceId, modelId: status?.modelId }))
    .catch(() => ({ enabled: false }));
  return statusPromise;
}

/**
 * Synthesises speech with ElevenLabs and returns an object URL for an MP3.
 * Results are cached per cacheKey so replays don't spend API credits.
 */
export async function synthesizeSpeech(text, { cacheKey = text, signal } = {}) {
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Voice service error (${response.status}).`);
  }

  const url = URL.createObjectURL(await response.blob());
  audioCache.set(cacheKey, url);
  return url;
}

export const browserSpeechAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
