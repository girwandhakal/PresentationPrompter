/** Shared canvas helpers for turning slides into stored images. Browser-only. */

export const SLIDE_WIDTH = 1920;
export const THUMB_WIDTH = 480;

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser can't render slides (canvas unavailable).");
  return { canvas, context };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP where the browser can encode it, JPEG otherwise. */
export async function encodeCanvas(canvas: HTMLCanvasElement, quality = 0.86) {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", Math.min(0.92, quality + 0.04));
  if (!jpeg) throw new Error("This browser couldn't encode the slide image.");
  return jpeg;
}

export async function makeThumbnail(source: HTMLCanvasElement) {
  const scale = THUMB_WIDTH / source.width;
  const { canvas, context } = createCanvas(THUMB_WIDTH, source.height * scale);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, 0.8);
}

/** Lets the page paint between heavy slide renders so progress stays visible and input responsive. */
export function yieldToBrowser() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
