// Prints scripts/landing/deck.html to a PDF with the local Chrome, plus PNG previews of each slide.
// Run: node scripts/landing/make-deck.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.join(process.cwd(), "scripts/landing");
const out = path.join(process.cwd(), "outputs/landing");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(path.join(here, "deck.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(out, "cooler-streets.pdf"), width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
const slides = await page.locator(".slide").all();
for (const [index, slide] of slides.entries()) await slide.screenshot({ path: path.join(out, `deck-${index + 1}.png`) });
await browser.close();
console.log(`Wrote ${slides.length} slides to ${path.relative(process.cwd(), out)}`);
