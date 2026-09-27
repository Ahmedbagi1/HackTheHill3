import { createTtsHandler } from '../../server/elevenLabsProxy.js';

let handler;

// Serves /api/tts/status and /api/tts/speak on Vercel. Keep ELEVENLABS_API_KEY
// (and optional ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID) in runtime
// environment variables, never a VITE_ variable.
export default function tts(req, res) {
  handler ??= createTtsHandler({
    allowedOrigins: [
      'https://www.civicos.work',
      ...(process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
        ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
  });
  return handler(req, res);
}
