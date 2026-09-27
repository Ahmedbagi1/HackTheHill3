/**
 * Shared Node.js handler for Vercel and Vite dev/preview text-to-speech routes.
 * The ElevenLabs API key is read on the server and never ships to the browser.
 *
 *   GET  /api/tts/status  -> { enabled, voiceId, modelId }
 *   POST /api/tts/speak   -> audio/mpeg   body: { "text": "..." }
 *   POST /api/tts         -> same as /api/tts/speak (Vite dev/preview only)
 *
 * Without ELEVENLABS_API_KEY, /api/tts/speak responds 503 and the client
 * falls back to the browser's built-in speech synthesis.
 */

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LENGTH = 5000;
const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_TIMEOUT_MS = 25_000;
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const MODEL_ID = /^[a-z0-9_]{3,64}$/;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
};

async function readText(req) {
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "Content-Type must be application/json.");
  }
  // Vercel provides a parsed body; Vite provides a raw IncomingMessage stream.
  let body = req.body;
  if (body === undefined) {
    body = await new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new RequestError(413, "Request body too large."));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", () => reject(new RequestError(400, "Could not read request body.")));
    });
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new RequestError(413, "Request body too large.");
    try {
      body = JSON.parse(body || "{}");
    } catch {
      throw new RequestError(400, "Request body must be valid JSON.");
    }
  }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) throw new RequestError(400, "`text` is required.");
  if (text.length > MAX_TEXT_LENGTH) throw new RequestError(413, `Text exceeds ${MAX_TEXT_LENGTH} characters.`);
  return text;
}

/**
 * Limits are per warm instance. Origin checks stop other sites from spending
 * voice credits through a visitor's browser; they are not bot protection.
 */
export function createTtsHandler({
  apiKey = process.env.ELEVENLABS_API_KEY,
  voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
  modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
  allowedOrigins = ["https://www.civicos.work"],
  legacyAlias = false,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  now = Date.now,
  maxRequests = 20,
  maxConcurrent = 3,
} = {}) {
  const key = apiKey?.trim() ?? "";
  // Malformed IDs would change the upstream URL; treat them as "not configured".
  const configured = VOICE_ID.test(voiceId) && MODEL_ID.test(modelId);
  const enabled = Boolean(key) && configured;
  if (key && !configured) console.warn("[elevenlabs] ELEVENLABS_VOICE_ID or ELEVENLABS_MODEL_ID is malformed; voice is disabled.");
  if (!key && process.env.VITE_ELEVENLABS_API_KEY) {
    // A VITE_ name would be a browser variable. It is never read or bundled.
    console.warn("[elevenlabs] Rename VITE_ELEVENLABS_API_KEY to ELEVENLABS_API_KEY; the VITE_ variable is ignored.");
  }

  let active = 0;
  let windowStarted = now();
  let requests = 0;

  return async (req, res, next = () => sendJson(res, 404, { error: "Not found." })) => {
    const path = req.url?.split("?")[0] ?? "";
    const task = path === "/api/tts" && legacyAlias ? "speak" : path.startsWith("/api/tts/") ? path.slice("/api/tts/".length) : null;
    if (task === null) return next();
    if (task !== "status" && task !== "speak") return sendJson(res, 404, { error: "Unknown voice task." });

    const method = task === "status" ? "GET" : "POST";
    if (req.method !== method) {
      res.setHeader("Allow", method);
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    if (task === "status") return sendJson(res, 200, { enabled, voiceId, modelId });
    if (!allowedOrigins.includes(req.headers.origin) || req.headers["sec-fetch-site"] === "cross-site") {
      return sendJson(res, 403, { error: "Request origin is not allowed." });
    }
    if (!enabled) return sendJson(res, 503, { error: "ElevenLabs is not configured. Set ELEVENLABS_API_KEY on the server." });

    if (now() - windowStarted >= 60_000) {
      windowStarted = now();
      requests = 0;
    }
    if (requests >= maxRequests || active >= maxConcurrent) {
      res.setHeader("Retry-After", "60");
      return sendJson(res, 429, { error: "The voice service is busy. Try again in a minute." });
    }
    requests++;
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await readText(req);
      const upstream = await fetchImpl(`${ELEVENLABS_BASE_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: modelId }),
        signal: controller.signal,
      });

      if (!upstream.ok) {
        // Log upstream status and a bounded excerpt server-side only; never echo the key or raw body.
        const detail = await upstream.text().catch(() => "");
        console.error(`[elevenlabs] ${upstream.status} ${upstream.statusText}: ${detail.slice(0, 300)}`);
        const status = upstream.status === 429 ? 429 : 502;
        const reason =
          upstream.status === 401 ? "the API key was rejected" : upstream.status === 429 ? "the voice quota or rate limit was reached" : `status ${upstream.status}`;
        return sendJson(res, status, { error: `ElevenLabs request failed: ${reason}.` });
      }

      const audio = Buffer.from(await upstream.arrayBuffer());
      if (!audio.length) return sendJson(res, 502, { error: "ElevenLabs returned no audio." });
      res.statusCode = 200;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audio.length);
      res.setHeader("Cache-Control", "no-store");
      res.end(audio);
    } catch (error) {
      if (error instanceof RequestError) return sendJson(res, error.status, { error: error.message });
      const timedOut = controller.signal.aborted;
      console.error(`[elevenlabs] ${timedOut ? "timeout" : "network error"}:`, timedOut ? "" : error?.message);
      return sendJson(res, timedOut ? 504 : 502, { error: timedOut ? "ElevenLabs timed out." : "Could not reach ElevenLabs." });
    } finally {
      clearTimeout(timer);
      active--;
    }
  };
}

/** Vite dev/preview plugin: same handler, local origins, legacy POST /api/tts alias. */
export function elevenLabsProxy({ apiKey, voiceId, modelId } = {}) {
  const handler = createTtsHandler({
    apiKey,
    voiceId: voiceId || DEFAULT_VOICE_ID,
    modelId: modelId || DEFAULT_MODEL_ID,
    allowedOrigins: ["http://localhost:5173", "http://localhost:4173"],
    legacyAlias: true,
  });
  return {
    name: "civicos-elevenlabs-proxy",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
