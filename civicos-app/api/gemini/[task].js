import { createGeminiHandler } from '../../server/geminiProxy.js';

let handler;

// Vercel discovers this Node.js function under the civicos-app project root.
// Keep the key in runtime environment variables, never a Vite define/import.
export default function gemini(req, res) {
  handler ??= createGeminiHandler({
    apiKey: process.env.GEMINI_API_KEY,
    allowedOrigins: [
      'https://www.civicos.work',
      ...(process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
        ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
  });
  return handler(req, res);
}
