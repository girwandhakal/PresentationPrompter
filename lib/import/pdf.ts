import type { ImportedSlide } from "../domain/factory";
import { createCanvas, encodeCanvas, makeThumbnail, SLIDE_WIDTH, yieldToBrowser } from "./raster";
import { firstLine, guessTitle, itemsToText, type TextItem } from "./pdf-text";
import { ImportError, sparseTextWarning, type ImportContext } from "./types";


export async function importPdf(file: File, context: ImportContext): Promise<ImportedSlide[]> {
  // The legacy build carries polyfills for newer JS built-ins, so imports work beyond the latest browsers.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document: Awaited<typeof loadingTask.promise>;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") throw new ImportError("This PDF is password-protected. Remove the password, then try again.");
    throw new ImportError("This PDF couldn't be opened. It may be damaged — try exporting it again.");
  }

  const total = document.numPages;
  context.assertSlideCount(total);
  const slides: ImportedSlide[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      context.progress({ stage: "rendering", done: pageNumber - 1, total });
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = SLIDE_WIDTH / base.width;
      const viewport = page.getViewport({ scale });
      const { canvas, context: ctx } = createCanvas(viewport.width, viewport.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const content = await page.getTextContent();
      const items: TextItem[] = content.items.flatMap((item) => ("str" in item ? [item as unknown as TextItem] : []));
      const text = itemsToText(items);
      const title = guessTitle(items, base.height) || firstLine(text) || `Slide ${pageNumber}`;

      const id = context.slideId();
      const image = await encodeCanvas(canvas);
      const thumb = await makeThumbnail(canvas);
      const imageKey = `${context.batch}/${id}/image`;
      const thumbKey = `${context.batch}/${id}/thumb`;
      context.addBlob(imageKey, image);
      context.addBlob(thumbKey, thumb);

      slides.push({
        id,
        sourceIndex: pageNumber,
        title,
        text,
        notes: "",
        imageKey,
        thumbKey,
        width: canvas.width,
        height: canvas.height,
        warnings: text.split(/\s+/).filter(Boolean).length < 4 ? [sparseTextWarning] : [],
      });
      page.cleanup();
      canvas.width = 0;
      await yieldToBrowser();
    }
  } finally {
    void loadingTask.destroy();
  }
  context.progress({ stage: "rendering", done: total, total });
  return slides;
}
