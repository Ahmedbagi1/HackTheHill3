/**
 * Text-to-speech client. Talks to the /api/tts proxy (server/elevenLabsProxy.js,
 * served by Vite locally and api/tts/[task].js on Vercel), which holds the
 * ElevenLabs API key.
 * When the proxy isn't available (static hosting, no key), callers fall back
 * to the browser's speechSynthesis voice.
 */

let statusPromise = null;
const audioCache = new Map();

/** Resolves to { enabled, voiceId, modelId }; cached for the session. */
export function getVoiceStatus() {
  statusPromise ??= fetch("/api/tts/status")
    .then((response) => {
      if (response.ok) return response.json();
      console.warn(`[voice] /api/tts/status responded ${response.status}; using the browser voice.`);
      return { enabled: false };
    })
    .then((status) => ({ enabled: Boolean(status?.enabled), voiceId: status?.voiceId, modelId: status?.modelId }))
    .catch((error) => {
      console.warn("[voice] Voice status unavailable; using the browser voice.", error);
      return { enabled: false };
    });
  return statusPromise;
}

/**
 * Synthesises speech with ElevenLabs and returns an object URL for an MP3.
 * Results are cached per cacheKey so replays don't spend API credits.
 */
export async function synthesizeSpeech(text, { cacheKey = text, signal } = {}) {
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

  const response = await fetch("/api/tts/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(typeof payload.error === "string" ? payload.error : `Voice service error (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  // A misrouted request (e.g. an HTML fallback page) would otherwise play as silence.
  if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("The voice service returned no audio.");
  const url = URL.createObjectURL(blob);
  audioCache.set(cacheKey, url);
  return url;
}

export const browserSpeechAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
