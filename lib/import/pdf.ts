import type { ImportedSlide } from "../domain/factory";
import { createCanvas, encodeCanvas, makeThumbnail, SLIDE_WIDTH, yieldToBrowser } from "./raster";
import { ImportError, sparseTextWarning, type ImportContext } from "./types";

type TextItem = { str: string; hasEOL: boolean; height: number; transform: number[] };


export async function importPdf(file: File, context: ImportContext): Promise<ImportedSlide[]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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

function itemsToText(items: TextItem[]) {
  let text = "";
  for (const item of items) {
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/** The largest text in the upper part of the page is usually the slide title. */
function guessTitle(items: TextItem[], pageHeight: number) {
  const candidates = items.filter((item) => item.str.trim() && item.height > 0 && item.transform[5] > pageHeight * 0.35);
  if (!candidates.length) return "";
  const max = Math.max(...candidates.map((item) => item.height));
  const title = candidates
    .filter((item) => item.height >= max * 0.9)
    .map((item) => item.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return title.length > 140 ? `${title.slice(0, 137)}…` : title;
}

function firstLine(text: string) {
  const line = text.split("\n").find((value) => value.trim())?.trim() ?? "";
  return line.length > 100 ? `${line.slice(0, 97)}…` : line;
}
