import type { ImportedSlide } from "../domain/factory";
import { fileBaseName } from "../domain/format";
import { createCanvas, encodeCanvas, makeThumbnail, SLIDE_WIDTH, yieldToBrowser } from "./raster";
import { ImportError, MAX_IMAGE_BYTES, sparseTextWarning, type ImportContext } from "./types";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Orders "slide 2.png" before "slide 10.png". */
export function sortImageFiles(files: File[]) {
  return [...files].sort((a, b) => collator.compare(a.name, b.name));
}

export async function importImages(files: File[], context: ImportContext): Promise<ImportedSlide[]> {
  const ordered = sortImageFiles(files);
  context.assertSlideCount(ordered.length);
  const slides: ImportedSlide[] = [];

  for (const [index, file] of ordered.entries()) {
    context.progress({ stage: "rendering", done: index, total: ordered.length });
    if (file.size > MAX_IMAGE_BYTES) throw new ImportError(`“${file.name}” is larger than 25 MB. Export slides at a smaller size.`);
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      throw new ImportError(`“${file.name}” couldn't be read as an image.`);
    }
    const scale = Math.min(1, SLIDE_WIDTH / bitmap.width, SLIDE_WIDTH / bitmap.height);
    const { canvas, context: ctx } = createCanvas(bitmap.width * scale, bitmap.height * scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const id = context.slideId();
    const imageKey = `${context.batch}/${id}/image`;
    const thumbKey = `${context.batch}/${id}/thumb`;
    context.addBlob(imageKey, await encodeCanvas(canvas, 0.9));
    context.addBlob(thumbKey, await makeThumbnail(canvas));
    slides.push({
      id,
      sourceIndex: index + 1,
      title: fileBaseName(file.name) || `Slide ${index + 1}`,
      text: "",
      notes: "",
      imageKey,
      thumbKey,
      width: canvas.width,
      height: canvas.height,
      warnings: [sparseTextWarning],
    });
    canvas.width = 0;
    await yieldToBrowser();
  }
  context.progress({ stage: "rendering", done: ordered.length, total: ordered.length });
  return slides;
}
