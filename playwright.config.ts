// Browser smoke test — catches the runtime-crash class (TDZ, recursion, bad
// imports) that the node check suite cannot see, without needing ComfyUI.
// Run: npx playwright test   (first time: npx playwright install chromium)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:5174" },
  webServer: {
    command: "npx vite --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
