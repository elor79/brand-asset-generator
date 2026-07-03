import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import canto from './vite-plugin-canto.js';

export default defineConfig(({ mode }) => {
  // Load .env.local / .env into process.env so the canto plugin can read it
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('CANTO_') && !process.env[k]) process.env[k] = v;
  }
  return {
    plugins: [react(), canto()],
    server: { port: 5173, open: true },
  };
});
