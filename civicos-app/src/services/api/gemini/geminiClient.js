/**
 * Browser side of the Gemini features. Requests go to the /api/gemini/* proxy
 * (server/geminiProxy.js), which holds the API key and calls gemini-3.5-flash-lite.
 */

export const GEMINI_MODEL = "gemini-3.5-flash-lite";

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
    .then((status) => ({ enabled: status?.enabled === true, model: typeof status?.model === "string" ? status.model : GEMINI_MODEL }))
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
    const code = response.status === 429 ? "RATE_LIMITED"
      : response.status === 404 || response.status === 503 ? "DISABLED"
        : [400, 403, 405, 413, 415].includes(response.status) ? "BAD_REQUEST" : "UPSTREAM";
    // Edge/firewall errors can be HTML or arbitrary upstream text. Never display
    // those bodies; keep an honest, bounded message in the existing UI.
    const message = code === "RATE_LIMITED" ? "AI is busy. Try again in a minute."
      : code === "DISABLED" ? "AI assistance is unavailable here."
        : code === "BAD_REQUEST" ? "The AI request was rejected. Check your input and try again."
          : "The AI service could not complete the request. Please retry.";
    throw new GeminiError(message, code);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new GeminiError("The AI returned an unreadable answer.", "INVALID_RESPONSE");
  return body;
}

/** True for errors that mean "AI isn't set up here" rather than "something went wrong". */
export const isGeminiDisabled = (error) => error instanceof GeminiError && error.code === "DISABLED";
