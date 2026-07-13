import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import canto from './vite-plugin-canto.js';
import genai from './vite-plugin-genai.js';

export default defineConfig(({ mode }) => {
  // Load .env.local / .env into process.env so the canto plugin can read it
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (/^(CANTO_|COMFY_)/.test(k) && !process.env[k]) process.env[k] = v;
  }
  return {
    plugins: [react(), canto(), genai()],
    // strictPort: fail loudly instead of quietly hopping to 5174. A drifting
    // port is how you end up with two app instances and a stale one in a tab.
    server: { port: 5173, strictPort: true, open: true },
  };
});
