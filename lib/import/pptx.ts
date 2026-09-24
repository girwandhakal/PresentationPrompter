import type JSZip from "jszip";
import type { ImportedSlide } from "../domain/factory";
import type { SlideWarning } from "../domain/types";
import { createCanvas, encodeCanvas, makeThumbnail, SLIDE_WIDTH, yieldToBrowser } from "./raster";
import { ImportError, type ImportContext } from "./types";

/**
 * PowerPoint import without a server: reads slide order, text, speaker notes, and the largest
 * picture from the OOXML package and renders a clean typographic version of each slide.
 * Exact visuals (layouts, charts, SmartArt) need a PDF export; each slide says so.
 */

const REL_NS_IMAGE = "/image";
const REL_NS_NOTES = "/notesSlide";

type ParsedSlide = {
  title: string;
  paragraphs: { text: string; level: number }[];
  notes: string;
  image: Blob | null;
  warnings: SlideWarning[];
};

const approximateWarning: SlideWarning = {
  kind: "approximate-render",
  message: "Shown as a simplified text preview. Export the deck as PDF from PowerPoint for exact visuals.",
};

function byLocal(root: Document | Element, name: string) {
  return Array.from(root.getElementsByTagNameNS("*", name));
}

function parseXml(source: string) {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new ImportError("This PowerPoint file is damaged or uses an unsupported format.");
  return document;
}

async function readXml(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? parseXml(await file.async("string")) : null;
}

function resolvePath(fromFile: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromFile.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

async function readRels(zip: JSZip, partPath: string) {
  const segments = partPath.split("/");
  const name = segments.pop()!;
  const relsPath = [...segments, "_rels", `${name}.rels`].join("/");
  const document = await readXml(zip, relsPath);
  const rels = new Map<string, { type: string; target: string }>();
  if (!document) return rels;
  for (const rel of byLocal(document, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (!id || !target || rel.getAttribute("TargetMode") === "External") continue;
    rels.set(id, { type: rel.getAttribute("Type") ?? "", target: resolvePath(partPath, target) });
  }
  return rels;
}

function paragraphText(paragraph: Element) {
  return byLocal(paragraph, "t").map((node) => node.textContent ?? "").join("").replace(/\s+/g, " ").trim();
}

/**
 * Reads a relationship attribute such as `r:id` or `r:embed`. Only namespaced attributes count:
 * `<p:sldId id="256" r:id="rId2">` carries a plain `id` too, which must not be mistaken for it.
 */
function relAttr(element: Element, name: string) {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === name && attribute.namespaceURI) return attribute.value;
  }
  return null;
}

export async function importPptx(file: File, context: ImportContext): Promise<{ slides: ImportedSlide[]; aspectRatio: number }> {
  const { default: JSZipLib } = await import("jszip");
  let zip: JSZip;
  try {
    zip = await JSZipLib.loadAsync(file);
  } catch {
    throw new ImportError("This PowerPoint file couldn't be opened. Try saving it again, or export it as PDF.");
  }

  const presentationPath = "ppt/presentation.xml";
  const presentation = await readXml(zip, presentationPath);
  if (!presentation) throw new ImportError("This file doesn't look like a PowerPoint presentation.");

  const size = byLocal(presentation, "sldSz")[0];
  const cx = Number(size?.getAttribute("cx")) || 12192000;
  const cy = Number(size?.getAttribute("cy")) || 6858000;
  const aspectRatio = cx / cy;

  const presentationRels = await readRels(zip, presentationPath);
  const slidePaths = byLocal(presentation, "sldId")
    .filter((node) => node.getAttribute("show") !== "0")
    .map((node) => presentationRels.get(relAttr(node, "id") ?? "")?.target)
    .filter((path): path is string => Boolean(path && zip.file(path)));

  if (!slidePaths.length) throw new ImportError("This presentation doesn't contain any visible slides.");
  context.assertSlideCount(slidePaths.length);

  const slides: ImportedSlide[] = [];
  for (const [index, path] of slidePaths.entries()) {
    context.progress({ stage: "rendering", done: index, total: slidePaths.length });
    const parsed = await parseSlide(zip, path);
    const width = SLIDE_WIDTH;
    const height = Math.round(SLIDE_WIDTH / aspectRatio);
    const canvas = await renderSlide(parsed, width, height, index + 1);

    const id = context.slideId();
    const imageKey = `${context.batch}/${id}/image`;
    const thumbKey = `${context.batch}/${id}/thumb`;
    context.addBlob(imageKey, await encodeCanvas(canvas, 0.9));
    context.addBlob(thumbKey, await makeThumbnail(canvas));
    const body = parsed.paragraphs.map((paragraph) => paragraph.text).join("\n");
    slides.push({
      id,
      sourceIndex: index + 1,
      title: parsed.title || parsed.paragraphs[0]?.text.slice(0, 100) || `Slide ${index + 1}`,
      text: [parsed.title, body].filter(Boolean).join("\n"),
      notes: parsed.notes,
      imageKey,
      thumbKey,
      width,
      height,
      warnings: parsed.warnings,
    });
    canvas.width = 0;
    await yieldToBrowser();
  }
  context.progress({ stage: "rendering", done: slidePaths.length, total: slidePaths.length });
  return { slides, aspectRatio };
}

async function parseSlide(zip: JSZip, path: string): Promise<ParsedSlide> {
  const document = await readXml(zip, path);
  if (!document) return { title: "", paragraphs: [], notes: "", image: null, warnings: [approximateWarning] };
  const rels = await readRels(zip, path);
  const warnings: SlideWarning[] = [approximateWarning];

  let title = "";
  const paragraphs: { text: string; level: number }[] = [];
  for (const shape of [...byLocal(document, "sp"), ...byLocal(document, "graphicFrame")]) {
    const placeholder = byLocal(shape, "ph")[0];
    const type = placeholder?.getAttribute("type") ?? "";
    if (["sldNum", "dt", "ftr"].includes(type)) continue;
    const texts = byLocal(shape, "p")
      .map((paragraph) => ({ text: paragraphText(paragraph), level: Number(byLocal(paragraph, "pPr")[0]?.getAttribute("lvl") ?? 0) }))
      .filter((paragraph) => paragraph.text);
    if (!texts.length) continue;
    if (!title && (type === "title" || type === "ctrTitle")) title = texts.map((paragraph) => paragraph.text).join(" ");
    else paragraphs.push(...texts);
  }

  // Largest embedded picture, by its drawn extent.
  let image: Blob | null = null;
  let bestArea = 0;
  for (const picture of byLocal(document, "pic")) {
    const blip = byLocal(picture, "blip")[0];
    const target = blip ? rels.get(relAttr(blip, "embed") ?? "") : undefined;
    if (!target || !target.type.endsWith(REL_NS_IMAGE) || !/\.(png|jpe?g|gif|webp|bmp)$/i.test(target.target)) continue;
    const extent = byLocal(picture, "ext")[0];
    const area = Number(extent?.getAttribute("cx") ?? 1) * Number(extent?.getAttribute("cy") ?? 1);
    if (area <= bestArea) continue;
    const entry = zip.file(target.target);
    if (!entry) continue;
    const bytes = await entry.async("uint8array");
    image = new Blob([bytes as BlobPart], { type: mimeFor(target.target) });
    bestArea = area;
  }

  if (byLocal(document, "timing").some((timing) => byLocal(timing, "par").length > 0)) {
    warnings.push({ kind: "animation", message: "Has animations or builds. Only the final state is shown, so check the order of your points." });
  }
  const types = [...rels.values()].map((rel) => rel.type);
  if (types.some((type) => type.endsWith("/video") || type.endsWith("/audio") || type.endsWith("/media"))) {
    warnings.push({ kind: "media", message: "Contains audio or video, which won't play here." });
  }
  if (types.some((type) => type.endsWith("/chart") || type.endsWith("/diagramData"))) {
    warnings.push({ kind: "media", message: "Contains a chart or SmartArt that can't be drawn from PowerPoint. Export as PDF to show it." });
  }

  let notes = "";
  const notesRel = [...rels.values()].find((rel) => rel.type.endsWith(REL_NS_NOTES));
  if (notesRel) {
    const notesDocument = await readXml(zip, notesRel.target);
    if (notesDocument) {
      notes = byLocal(notesDocument, "sp")
        .filter((shape) => byLocal(shape, "ph")[0]?.getAttribute("type") === "body")
        .flatMap((shape) => byLocal(shape, "p").map(paragraphText))
        .filter(Boolean)
        .join("\n");
    }
  }

  return { title, paragraphs, notes, image, warnings };
}

function mimeFor(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "bmp") return "image/bmp";
  return "image/png";
}

// ── Typographic rendering ───────────────────────────────────────────────────

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderSlide(slide: ParsedSlide, width: number, height: number, number: number) {
  const { canvas, context } = createCanvas(width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const margin = Math.round(width * 0.06);
  context.textBaseline = "top";

  let bitmap: ImageBitmap | null = null;
  if (slide.image) {
    try { bitmap = await createImageBitmap(slide.image); } catch { bitmap = null; }
  }
  const textRight = bitmap && slide.paragraphs.length ? width * 0.56 : width - margin;
  const textWidth = textRight - margin;

  // Title
  let y = margin;
  if (slide.title) {
    let size = Math.round(height * 0.085);
    context.font = `700 ${size}px ${FONT}`;
    let lines = wrap(context, slide.title, textWidth);
    while (lines.length > 3 && size > 28) {
      size -= 4;
      context.font = `700 ${size}px ${FONT}`;
      lines = wrap(context, slide.title, textWidth);
    }
    context.fillStyle = "#070600";
    for (const line of lines.slice(0, 3)) {
      context.fillText(line, margin, y);
      y += size * 1.15;
    }
    y += size * 0.5;
  }

  // Body text, shrunk until it fits.
  if (slide.paragraphs.length) {
    const available = height - margin - y;
    let size = Math.round(height * 0.045);
    let layout: { text: string; x: number; lines: string[] }[] = [];
    const measure = () => {
      context.font = `400 ${size}px ${FONT}`;
      layout = slide.paragraphs.map((paragraph) => {
        const indent = margin + paragraph.level * size * 1.4 + size * 1.1;
        return { text: paragraph.text, x: indent, lines: wrap(context, paragraph.text, textRight - indent) };
      });
      return layout.reduce((sum, block) => sum + block.lines.length * size * 1.35 + size * 0.45, 0);
    };
    while (measure() > available && size > 16) size -= 2;
    context.fillStyle = "#2b2a26";
    for (const block of layout) {
      if (y + size > height - margin * 0.6) break;
      context.beginPath();
      context.arc(block.x - size * 0.7, y + size * 0.55, size * 0.14, 0, Math.PI * 2);
      context.fill();
      for (const line of block.lines) {
        if (y + size > height - margin * 0.6) break;
        context.fillText(line, block.x, y);
        y += size * 1.35;
      }
      y += size * 0.45;
    }
  }

  // Largest picture, fitted to the free area.
  if (bitmap) {
    const boxX = slide.paragraphs.length ? width * 0.6 : margin;
    const boxY = slide.paragraphs.length || !slide.title ? margin : y;
    const boxW = (slide.paragraphs.length ? width * 0.94 : width - margin) - boxX;
    const boxH = height - margin - boxY;
    const scale = Math.min(boxW / bitmap.width, boxH / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    context.drawImage(bitmap, boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);
    bitmap.close();
  }

  if (!slide.title && !slide.paragraphs.length && !bitmap) {
    context.fillStyle = "#8c8680";
    context.font = `500 ${Math.round(height * 0.04)}px ${FONT}`;
    context.fillText(`Slide ${number}`, margin, margin);
  }
  return canvas;
}
