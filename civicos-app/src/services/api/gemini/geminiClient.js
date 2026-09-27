/**
 * Browser side of the Gemini features. Requests go to the /api/gemini/* proxy
 * (server/geminiProxy.js), which holds the API key and calls gemini-2.5-flash.
 */

export const GEMINI_MODEL = "gemini-2.5-flash";

export class GeminiError extends Error {
  /**
   * @param {string} message
   * @param {"DISABLED" | "RATE_LIMITED" | "UPSTREAM" | "NETWORK" | "INVALID_RESPONSE" | "EMPTY" | "BAD_REQUEST"} code
   */
  constructor(message, code) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
  }
}

let statusPromise = null;

/** { enabled, model }; resolves to disabled when the proxy is unreachable (e.g. a static deploy). */
export function getGeminiStatus() {
  statusPromise ??= fetch("/api/gemini/status")
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((status) => ({ enabled: Boolean(status.enabled), model: status.model ?? GEMINI_MODEL }))
    .catch(() => ({ enabled: false, model: GEMINI_MODEL }));
  return statusPromise;
}

/** POSTs to one Gemini task and returns the parsed JSON, or throws GeminiError. */
export async function callGeminiTask(task, payload, { signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/gemini/${task}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new GeminiError("Couldn't reach the CivicOS AI service.", "NETWORK");
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON responses fall through to the error handling below.
  }

  if (!response.ok) {
    // 404 means no proxy is running (static hosting), which is equivalent to "not configured".
    const code = body?.code ?? (response.status === 404 || response.status === 503 ? "DISABLED" : response.status === 400 ? "BAD_REQUEST" : "UPSTREAM");
    throw new GeminiError(body?.error ?? `AI request failed (${response.status}).`, code);
  }
  if (!body || typeof body !== "object") throw new GeminiError("The AI returned an unreadable answer.", "INVALID_RESPONSE");
  return body;
}

/** True for errors that mean "AI isn't set up here" rather than "something went wrong". */
export const isGeminiDisabled = (error) => error instanceof GeminiError && error.code === "DISABLED";
