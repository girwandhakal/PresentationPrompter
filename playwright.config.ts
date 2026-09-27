import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run against a production build with the deterministic demo AI (no API key, no
 * network); the dev server compiles routes on first visit, which outlasts short-lived toasts. They
 * use the locally installed Chrome, so no browser download is needed; set PLAYWRIGHT_CHANNEL=msedge
 * (or "" for Playwright's bundled Chromium) to change it.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npx cross-env AI_PROVIDER=demo next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/ai/status`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
