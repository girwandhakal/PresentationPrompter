import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run against the dev server with the deterministic demo AI (no API key, no
 * network). They use the locally installed Chrome, so no browser download is needed; set
 * PLAYWRIGHT_CHANNEL=msedge (or "" for Playwright's bundled Chromium) to change it.
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
    command: `npx cross-env AI_PROVIDER=demo WRANGLER_LOG_PATH=.wrangler/wrangler.log vinext dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/ai/status`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
