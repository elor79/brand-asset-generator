import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import canto from './vite-plugin-canto.js';
import genai from './vite-plugin-genai.js';

export default defineConfig(({ mode }) => {
  // Load .env.local / .env into process.env so the canto plugin can read it
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (/^(CANTO_|COMFY_|WEBUI_)/.test(k) && !process.env[k]) process.env[k] = v;
  }
  return {
    plugins: [react(), canto(), genai()],
    // 5174 — NOT 5173. Cadence lives on 5173, and localStorage is scoped per
    // origin (port included): if this app takes 5173, Cadence gets bumped to 5174
    // and opens onto an empty workspace, because its saved data is on the origin
    // it no longer has. One app, one port, pinned. strictPort so it fails loudly
    // rather than drifting into someone else's storage.
    server: { port: 5174, strictPort: true, open: true },
  };
});
