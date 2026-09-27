import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { civicFeedsProxy } from "./server/civicFeedsProxy.js";
import { elevenLabsProxy } from "./server/elevenLabsProxy.js";
import { geminiProxy } from "./server/geminiProxy.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (not just VITE_*) so the ElevenLabs and Gemini keys stay server-side.
  const env = loadEnv(mode, process.cwd(), "");
  // Vite does not populate process.env from .env.local. Keep this private value
  // in the Node process so local and Vercel handlers use the same runtime lookup.
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY ??= env.GEMINI_API_KEY;

  return {
    // Only these identifiers are browser configuration. Never expose arbitrary
    // VITE_* variables: a private API key may have been misnamed locally/in CI.
    envPrefix: [],
    define: Object.fromEntries(
      ["VITE_AUTH0_DOMAIN", "VITE_AUTH0_CLIENT_ID", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]
        .map((name) => [`import.meta.env.${name}`, JSON.stringify(env[name] ?? "")]),
    ),
    server: { port: 5173, strictPort: true },
    plugins: [
      react(),
      elevenLabsProxy({
        apiKey: env.ELEVENLABS_API_KEY,
        voiceId: env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb",
        modelId: env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      }),
      civicFeedsProxy(),
      geminiProxy(),
    ],
    build: {
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks cache across app deploys.
          advancedChunks: {
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: "auth", test: /node_modules[\\/]@auth0[\\/]/ },
              { name: "icons", test: /node_modules[\\/]lucide-react[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
