/**
 * Vite dev/preview middleware that proxies text-to-speech requests to
 * ElevenLabs so the API key stays on the server and never ships to the browser.
 *
 *   GET  /api/tts/status  -> { enabled, voiceId, modelId }
 *   POST /api/tts         -> audio/mpeg   body: { "text": "..." }
 *
 * When ELEVENLABS_API_KEY is not set, /api/tts responds 503 and the client
 * falls back to the browser's built-in speech synthesis.
 */

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MAX_TEXT_LENGTH = 2500;
const MAX_BODY_BYTES = 16 * 1024;

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });

export function elevenLabsProxy({ apiKey, voiceId, modelId }) {
  const enabled = Boolean(apiKey);

  const handler = async (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (path !== "/api/tts" && path !== "/api/tts/status") return next();

    if (path === "/api/tts/status") {
      return sendJson(res, 200, { enabled, voiceId, modelId });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    if (!enabled) {
      return sendJson(res, 503, {
        error: "ElevenLabs is not configured. Set ELEVENLABS_API_KEY.",
      });
    }

    let text;
    try {
      ({ text } = await readJsonBody(req));
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }

    if (typeof text !== "string" || !text.trim()) {
      return sendJson(res, 400, { error: "`text` is required." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return sendJson(res, 413, {
        error: `Text exceeds ${MAX_TEXT_LENGTH} characters.`,
      });
    }

    try {
      const upstream = await fetch(
        `${ELEVENLABS_BASE_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text: text.trim(), model_id: modelId }),
        },
      );

      if (!upstream.ok) {
        // Log upstream details server-side only; never echo the key or raw body.
        const detail = await upstream.text().catch(() => "");
        console.error(
          `[elevenlabs] ${upstream.status} ${upstream.statusText}: ${detail.slice(0, 300)}`,
        );
        return sendJson(res, 502, {
          error: `ElevenLabs request failed (${upstream.status}).`,
        });
      }

      const audio = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = 200;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audio.length);
      res.setHeader("Cache-Control", "no-store");
      res.end(audio);
    } catch (error) {
      console.error("[elevenlabs] network error:", error);
      sendJson(res, 502, { error: "Could not reach ElevenLabs." });
    }
  };

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
