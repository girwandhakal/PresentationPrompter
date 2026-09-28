import { shortId, type ImportedSlide } from "../domain/factory";
import { fileBaseName } from "../domain/format";
import type { SourceKind } from "../domain/types";
import { importImages } from "./images";
import { importPdf } from "./pdf";
import { importPptx } from "./pptx";
import { ImportError, MAX_FILE_BYTES, MAX_SLIDES, type ImportContext, type ImportProgress } from "./types";

export { ImportError, MAX_SLIDES, type ImportProgress };

export type DetectedKind = SourceKind | "legacy-ppt" | "keynote" | "unknown";

export type ImportResult = {
  title: string;
  fileName: string;
  kind: SourceKind;
  bytes: number;
  aspectRatio: number;
  slides: ImportedSlide[];
  blobs: [string, Blob][];
};

/** Archives opened while detecting a file's type, reused by the importer instead of unzipping twice. */
const openedArchives = new WeakMap<File, import("jszip")>();

export const ACCEPTED_TYPES = ".pdf,.pptx,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

/** Identifies a file by its leading bytes; names and browser MIME types are only hints. */
export async function detectKind(file: File): Promise<DetectedKind> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...head);
  const name = file.name.toLowerCase();
  if (ascii.startsWith("%PDF")) return "pdf";
  if (head[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "images";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "images";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "images";
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return name.endsWith(".ppt") ? "legacy-ppt" : "unknown";
  if (ascii.startsWith("PK")) {
    if (name.endsWith(".key")) return "keynote";
    const { default: JSZip } = await import("jszip");
    try {
      const zip = await JSZip.loadAsync(file);
      openedArchives.set(file, zip);
      if (zip.file("ppt/presentation.xml")) return "pptx";
      if (zip.file(/^Index\//).length) return "keynote";
    } catch { /* fall through */ }
  }
  return "unknown";
}

function explainUnsupported(kind: DetectedKind, file: File) {
  if (kind === "legacy-ppt") return "Older .ppt files aren't supported. Open it in PowerPoint and save as .pptx or export as PDF.";
  if (kind === "keynote") return "Keynote files aren't supported directly. In Keynote, choose File → Export To → PDF, then upload the PDF.";
  return `“${file.name}” isn't a supported file. Upload a PDF, a PowerPoint (.pptx) file, or slide images (PNG, JPEG, WebP).`;
}

/**
 * Validates and converts the chosen files into slide records plus image blobs.
 * Accepts one PDF, one PPTX, or one or more images (ordered by filename).
 */
export async function importFiles(files: File[], onProgress: (progress: ImportProgress) => void): Promise<ImportResult> {
  if (!files.length) throw new ImportError("Choose a file to import.");
  const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversized) throw new ImportError(`“${oversized.name}” is larger than 100 MB. Compress it or export fewer slides.`);
  const empty = files.find((file) => file.size === 0);
  if (empty) throw new ImportError(`“${empty.name}” is empty.`);

  onProgress({ stage: "reading", done: 0, total: files.length });
  const kinds = await Promise.all(files.map(detectKind));

  if (files.length > 1) {
    const bad = kinds.findIndex((kind) => kind !== "images");
    if (bad >= 0) throw new ImportError(kinds[bad] === "pdf" || kinds[bad] === "pptx" ? "Upload one PDF or PowerPoint file at a time. Multiple files are only for slide images." : explainUnsupported(kinds[bad], files[bad]));
  }

  const kind = kinds[0];
  const blobs: [string, Blob][] = [];
  const context: ImportContext = {
    batch: shortId(8),
    slideId: () => shortId(8),
    addBlob: (key, blob) => { blobs.push([key, blob]); },
    progress: onProgress,
    assertSlideCount: (count) => {
      if (count > MAX_SLIDES) throw new ImportError(`This deck has ${count} slides. Cueframe supports up to ${MAX_SLIDES}; split it into smaller presentations.`);
      if (count === 0) throw new ImportError("No slides were found in this file.");
    },
  };

  const file = files[0];
  if (kind === "pdf") {
    const slides = await importPdf(file, context);
    return { title: fileBaseName(file.name), fileName: file.name, kind: "pdf", bytes: file.size, aspectRatio: slides[0].width / slides[0].height, slides, blobs };
  }
  if (kind === "pptx") {
    const { slides, aspectRatio } = await importPptx(file, context, openedArchives.get(file));
    return { title: fileBaseName(file.name), fileName: file.name, kind: "pptx", bytes: file.size, aspectRatio, slides, blobs };
  }
  if (kind === "images") {
    const slides = await importImages(files, context);
    const bytes = files.reduce((sum, item) => sum + item.size, 0);
    const title = files.length === 1 ? fileBaseName(file.name) : "Untitled presentation";
    return { title, fileName: files.length === 1 ? file.name : `${files.length} images`, kind: "images", bytes, aspectRatio: slides[0].width / slides[0].height, slides, blobs };
  }
  throw new ImportError(explainUnsupported(kind, file));
}
