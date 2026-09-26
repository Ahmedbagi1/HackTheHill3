import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { civicFeedsProxy } from "./server/civicFeedsProxy.js";
import { elevenLabsProxy } from "./server/elevenLabsProxy.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (not just VITE_*) so the ElevenLabs key stays server-side.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: { port: 5173, strictPort: true },
    plugins: [
      react(),
      elevenLabsProxy({
        apiKey: env.ELEVENLABS_API_KEY,
        voiceId: env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb",
        modelId: env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      }),
      civicFeedsProxy(),
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
