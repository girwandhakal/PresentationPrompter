// Records the landing-page screenshots and clips from the real app.
//
// 1. Build and serve with sign-in off and the demo AI (no API key, no network):
//      npx cross-env NEXT_PUBLIC_AUTH_MODE=off npm run build
//      npx cross-env AI_PROVIDER=demo next start --port 3150
// 2. node scripts/landing/make-deck.mjs && node scripts/landing/capture.mjs
//
// Everything on screen is the product running normally. The one substitution: the /api/ai/write
// response keeps its structure but carries the hand-written paragraphs from script.mjs, because the
// demo provider only rearranges slide text and paid model runs aren't authorized for this.
// Outputs: public/landing/*.webp (stills and posters) and *.mp4 (H.264, no audio).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { SCRIPT } from "./script.mjs";

const BASE = process.env.CAPTURE_URL ?? "http://localhost:3150";
const ROOT = process.cwd();
const DECK = path.join(ROOT, "outputs/landing/cooler-streets.pdf");
const RAW = path.join(ROOT, "outputs/landing/raw");
const OUT = path.join(ROOT, "public/landing");
mkdirSync(OUT, { recursive: true });
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A visible pointer, since screencasts don't include the OS cursor. Hidden until the mouse first moves. */
const CURSOR = () => {
  const install = () => {
    if (document.getElementById("capture-cursor")) return;
    const cursor = document.createElement("div");
    cursor.id = "capture-cursor";
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M5 3l15 9.2-6.6 1.4 3.9 7.6-2.9 1.5-3.9-7.6L5 20z" fill="#070600" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(cursor.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", opacity: "0", transform: "translate(-100px,-100px)", transition: "opacity 200ms", filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.25))" });
    document.documentElement.appendChild(cursor);
    addEventListener("mousemove", (event) => {
      cursor.style.opacity = document.documentElement.dataset.captureStill ? "0" : "1";
      cursor.style.transform = `translate(${event.clientX - 5}px, ${event.clientY - 3}px)`;
    }, { capture: true, passive: true });
    addEventListener("mousedown", () => { cursor.firstChild.style.transform = "scale(0.86)"; }, true);
    addEventListener("mouseup", () => { cursor.firstChild.style.transform = ""; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
};

/** Records a page through the DevTools screencast; frames arrive only when something repaints. */
async function record(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const dir = path.join(RAW, name);
  mkdirSync(dir, { recursive: true });
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    const file = path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    // Stamped on arrival so every recording shares one clock (screencast timestamps can drift).
    frames.push({ file, t: Date.now() / 1000 });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92 });
  const start = Date.now() / 1000;
  return {
    start,
    frames,
    async stop(options = {}) {
      const end = options.end ?? Date.now() / 1000;
      await cdp.send("Page.stopScreencast");
      await cdp.detach();
      encode(name, frames, options.from ?? start, end, options);
    },
  };
}

/** Turns timestamped frames into a constant-rate H.264 clip and a WebP poster. */
function encode(name, frames, from, end, { speed = 1, width = 1440, poster = "last" } = {}) {
  if (!frames.length) throw new Error(`No frames recorded for ${name}`);
  const list = [];
  const kept = frames.filter((frame, index) => frame.t >= from || frames[index + 1]?.t > from);
  kept.forEach((frame, index) => {
    const next = kept[index + 1]?.t ?? end;
    // The first frame also covers any gap back to `from`, so clips recorded together stay aligned.
    const duration = Math.max(0.001, next - (index === 0 ? from : frame.t));
    list.push(`file '${frame.file.replace(/\\/g, "/")}'`, `duration ${duration.toFixed(4)}`);
  });
  list.push(`file '${kept.at(-1).file.replace(/\\/g, "/")}'`);
  // The concat demuxer holds the final entry for an extra beat; -t trims the clip to the real length.
  const listFile = path.join(RAW, `${name}.txt`);
  writeFileSync(listFile, list.join("\n"));
  const video = path.join(OUT, `${name}.mp4`);
  const filters = [`setpts=PTS/${speed}`, "fps=30", `scale=${width}:-2:flags=lanczos`, "format=yuv420p"].join(",");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", filters, "-t", ((end - from) / speed).toFixed(3), "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-tune", "animation", "-movflags", "+faststart", "-an", video]);
  const posterFrame = poster === "first" ? kept[0].file : kept.at(-1).file;
  return sharp(posterFrame).resize({ width }).webp({ quality: 78 }).toFile(path.join(OUT, `${name}-poster.webp`));
}

async function still(page, name, width = 2400) {
  await page.evaluate(() => { document.documentElement.dataset.captureStill = "1"; document.getElementById("capture-cursor")?.style.setProperty("opacity", "0"); });
  await wait(250);
  const buffer = await page.screenshot();
  await page.evaluate(() => { delete document.documentElement.dataset.captureStill; });
  await sharp(buffer).resize({ width }).webp({ quality: 80 }).toFile(path.join(OUT, `${name}.webp`));
}

/** Glides the visible pointer to an element and clicks it. */
async function click(page, locator, { steps = 32, pause = 180 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await wait(pause);
  await page.mouse.down();
  await wait(70);
  await page.mouse.up();
}

/** Selects the exact phrase inside an editor with a mouse drag, as a person would. */
async function selectPhrase(page, editor, phrase) {
  const rect = await editor.evaluate((root, text) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent.indexOf(text);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      const rects = [...range.getClientRects()];
      const first = rects[0];
      const last = rects.at(-1);
      return { x1: first.left + 1, y1: first.top + first.height / 2, x2: last.right - 1, y2: last.top + last.height / 2 };
    }
    return null;
  }, phrase);
  if (!rect) throw new Error(`Phrase not found: ${phrase}`);
  await page.mouse.move(rect.x1, rect.y1, { steps: 24 });
  await page.mouse.down();
  await page.mouse.move(rect.x2, rect.y2, { steps: 30 });
  await page.mouse.up();
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "no-preference" });
// Time flows normally; the review rehearsal below jumps it forward.
await context.clock.install();
await context.addInitScript(CURSOR);
await context.addInitScript(() => {
  try { localStorage.setItem("cueframe:pref:theme", JSON.stringify("light")); } catch {}
});
await context.route("**/api/ai/write", async (route) => {
  const request = route.request().postDataJSON();
  const response = await route.fetch();
  const body = await response.json();
  for (const slide of body.slides) {
    const input = request.slides.find((candidate) => candidate.id === slide.id);
    const paragraphs = SCRIPT[input.index - 1];
    if (!slide.script || !paragraphs) continue;
    slide.script.paragraphs = paragraphs;
    slide.script.concise = paragraphs.map((paragraph) => paragraph.match(/^[^.!?]+[.!?]/)?.[0] ?? paragraph).join(" ");
  }
  // Local advisory notes were computed for the replaced text; they don't apply to this one.
  body.notes = body.slides.map(({ id }) => ({ id, issues: [] }));
  await route.fulfill({ response, json: body });
});

const page = await context.newPage();
page.setDefaultTimeout(30_000);

// ── Hero: deck in, script out ───────────────────────────────────────────────
await page.goto(`${BASE}/home`);
await page.locator('nav[aria-label="Your presentations"][data-ready]').waitFor({ state: "attached" });
await page.getByRole("heading", { name: "Import your slides" }).waitFor();
await page.mouse.move(1100, 720);
await wait(600);
const hero = await record(page, "hero");
await wait(700);
const dropzone = page.locator("input[type=file]").first().locator("xpath=ancestor::*[self::label or self::div][1]");
const dropBox = await dropzone.boundingBox();
await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, { steps: 36 });
await wait(350);
await page.locator("input[type=file]").first().setInputFiles(DECK);
await page.waitForURL(/\/p\/[a-z0-9]+\/setup$/);
const id = page.url().match(/\/p\/([a-z0-9]+)\//)[1];
const goal = page.getByRole("textbox", { name: "Goal" });
await goal.waitFor();
// Slide analysis fills the goal in the background.
while (!(await goal.inputValue())) await wait(150);
// The demo provider's suggestions echo slide text; use what a presenter would type.
await goal.fill("Win a three-year budget commitment for street trees");
await page.getByRole("textbox", { name: "Key message" }).fill("Shade is the cheapest way to cool the Eastside");
await wait(1200);
const audienceField = page.getByRole("textbox", { name: "Audience" });
await click(page, audienceField);
await page.keyboard.press("Control+A");
await page.keyboard.type("City council members and neighbors", { delay: 38 });
await wait(500);
await still(page, "setup");
await click(page, page.getByRole("button", { name: "Write my script" }));
await page.waitForURL(new RegExp(`/p/${id}/edit`));
const first = page.getByRole("textbox", { name: "Script for slide 1" });
await first.waitFor();
await page.getByText("Hello, everyone.").first().waitFor();
await page.mouse.move(1180, 820, { steps: 20 });
await wait(2600);
await page.keyboard.press("Alt+ArrowDown");
await page.getByRole("textbox", { name: "Script for slide 2" }).waitFor();
await wait(2600);
await hero.stop({ speed: 1.15 });
await still(page, "editor");

// ── Editing: your words, your cues ──────────────────────────────────────────
const second = page.getByRole("textbox", { name: "Script for slide 2" });
const edit = await record(page, "edit");
await wait(600);
await selectPhrase(page, second, "eleven degrees hotter");
await wait(700);
await page.keyboard.press("Control+B");
await wait(500);
// A private cue on its own line after the numbers: caret to the end of the first paragraph, then Cue.
await selectPhrase(page, second, "Our blocks hit ninety-five.");
await page.keyboard.press("ArrowRight");
await wait(500);
await click(page, page.locator(".cue-button:visible").first(), { steps: 26 });
await wait(300);
await page.keyboard.type("Point at the orange bar", { delay: 45 });
await wait(600);
// Proposals never overwrite on their own: preview one, then keep the original.
await click(page, page.getByRole("button", { name: "Improve" }));
await wait(400);
await click(page, page.getByRole("menuitem", { name: "More conversational" }), { steps: 18 });
await page.getByRole("region", { name: "Proposed change" }).waitFor();
await wait(1800);
await click(page, page.getByRole("button", { name: "Discard" }));
await wait(1400);
await edit.stop();
await page.locator('.editor[data-save-state="saved"]').waitFor({ state: "attached" });

// ── The stage: presenter and audience, recorded together ────────────────────
await page.goto(`${BASE}/p/${id}/present`);
await page.getByRole("button", { name: "Start presenting" }).waitFor();
await page.mouse.move(1200, 700);
await wait(800);
const stage = await record(page, "stage-presenter");
await wait(600);
const size = stage.frames[0] && await sharp(stage.frames[0].file).metadata();
if (!size || size.width !== 1440) throw new Error(`Presenter frames are ${size?.width}x${size?.height}, expected 1440 wide`);
// Starting opens the audience as a pop-up window, as it does for a real presenter. Its own window
// keeps both pages at their full size while they're recorded together.
const popup = context.waitForEvent("page");
await click(page, page.getByRole("button", { name: "Start presenting" }));
const audience = await popup;
await audience.setViewportSize({ width: 1280, height: 720 });
const room = await record(audience, "stage-audience");
await page.getByRole("dialog").waitFor({ state: "hidden" });
// Both clips start once the talk is live: the audience window is still loading before that.
const live = Date.now() / 1000;
await page.mouse.move(1430, 890, { steps: 12 });
await wait(900);
await page.keyboard.press("Space");
await wait(6500);
await still(page, "presenter");
await page.keyboard.press("ArrowRight");
await wait(3800);
await page.keyboard.press("b");
await wait(2200);
await page.keyboard.press("b");
await wait(1600);
await page.keyboard.press("ArrowRight");
await wait(3200);
// Both clips end at the same instant (encoding the first one takes a while).
const stageEnd = Date.now() / 1000;
await stage.stop({ from: live, end: stageEnd });
await room.stop({ from: live, end: stageEnd, width: 1280 });

async function endSession() {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End and review" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/review`));
  await page.getByRole("heading", { name: "Session review" }).waitFor();
}
await endSession();

// A full-length rehearsal for the review, not recorded: the page clock jumps ahead by a realistic
// time on each slide instead of the capture waiting eight minutes.
await page.getByRole("link", { name: "Present again" }).click();
await page.waitForURL(new RegExp(`/p/${id}/present`));
await page.getByRole("button", { name: "Start presenting" }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
for (const [index, seconds] of [62, 96, 71, 104, 88, 38].entries()) {
  await wait(300);
  await context.clock.fastForward(seconds * 1000);
  await wait(300);
  if (index < 5) await page.keyboard.press("ArrowRight");
}
await endSession();
await page.mouse.move(1430, 890);
await wait(1200);
await still(page, "review");

await browser.close();
console.log(`Captured project ${id} into ${path.relative(ROOT, OUT)}`);
