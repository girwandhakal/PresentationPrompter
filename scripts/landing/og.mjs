// Renders public/og.png (the social preview) from the landing page itself.
// Serve a production build first, as for capture.mjs, then: node scripts/landing/og.mjs
import { chromium } from "@playwright/test";
import path from "node:path";

const BASE = process.env.CAPTURE_URL ?? "http://localhost:3150";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const context = await browser.newContext({ viewport: { width: 1680, height: 941 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// With reduced motion the hero is at rest, so the card matches the finished page.
await page.locator(".hero__demo video").evaluate((video) => new Promise((resolve) => {
  if (video.readyState >= 2 || video.poster) resolve();
  else video.addEventListener("loadeddata", resolve, { once: true });
}));
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(process.cwd(), "public/og.png") });
await browser.close();
console.log("Wrote public/og.png");
