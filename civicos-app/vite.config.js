import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
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
    ],
  };
});
