// Renders a recorded clip: timestamped frames in, a constant-rate H.264 clip and WebP poster out.
// capture.mjs calls this as it records, and saves each clip's frames and pointer track beside the
// raw frames, so the zoom and encoding can be tuned without recording again:
//   node scripts/landing/render.mjs hero edit
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { cropFor, planCamera } from "./camera.mjs";

const ROOT = process.cwd();
export const RAW = path.join(ROOT, "outputs/landing/raw");
const OUT = path.join(ROOT, "public/landing");

/**
 * With `zoom`, each output frame is cropped to the camera planned from the pointer track, from
 * frames recorded at twice the page's pixel density.
 */
export async function render(name, recording) {
  const { view, speed = 1, width = 1440, fps = 30, crf = 25, poster = "last", zoom, cuts = [] } = recording;
  if (!recording.frames.length) throw new Error(`No frames recorded for ${name}`);
  writeFileSync(path.join(RAW, `${name}.json`), JSON.stringify(recording));
  // Cuts remove time the capture spent on itself (taking stills), not time the app took.
  const squash = (t) => t - cuts.reduce((sum, [start, stop]) => sum + Math.min(Math.max(t - start, 0), stop - start), 0);
  const frames = recording.frames.map((frame) => ({ ...frame, t: squash(frame.t) }));
  const events = (recording.events ?? []).map((event) => ({ ...event, t: squash(event.t) }));
  const from = squash(recording.from);
  const end = squash(recording.end);
  const size = await sharp(frames[0].file).metadata();
  const height = Math.round((width * view.height) / view.width / 2) * 2;
  const camera = zoom ? planCamera(events, { from, end, view, ...zoom }) : null;
  if (camera) console.log(`${name}: ${camera.segments.map((segment) => `${(segment.start - from).toFixed(1)}–${(segment.end - from).toFixed(1)}s`).join(", ") || "no zoom"}`);
  const dir = path.join(RAW, `${name}-out`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const count = Math.round(((end - from) / speed) * fps);
  let source = 0;
  let previous = null;
  for (let index = 0; index < count; index++) {
    const t = from + (index / fps) * speed;
    while (frames[source + 1] && frames[source + 1].t <= t) source++;
    const shot = camera ? camera.at(t) : { s: 1, x: view.width / 2, y: view.height / 2 };
    const crop = cropFor(shot, view, size);
    const key = `${source}:${crop.left}:${crop.top}:${crop.width}`;
    const file = path.join(dir, `${String(index).padStart(5, "0")}.png`);
    // Still stretches repeat the previous output rather than resampling the same pixels.
    if (previous?.key === key) copyFileSync(previous.file, file);
    else await sharp(frames[source].file).extract(crop).resize(width, height, { kernel: "lanczos3", fit: "fill" }).png({ compressionLevel: 1 }).toFile(file);
    previous = { key, file };
  }
  const video = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", path.join(dir, "%05d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", video]);
  const posterFrame = path.join(dir, `${String(poster === "first" ? 0 : count - 1).padStart(5, "0")}.png`);
  await sharp(posterFrame).webp({ quality: 78 }).toFile(path.join(OUT, `${name}-poster.webp`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const name of process.argv.slice(2)) {
    const saved = JSON.parse(readFileSync(path.join(RAW, `${name}.json`), "utf8"));
    await render(name, saved);
    console.log(`Rendered ${name}`);
  }
}
