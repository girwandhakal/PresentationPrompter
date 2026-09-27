export type ScriptText = {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Read this passage more slowly. */
  slow?: boolean;
};

export type ScriptCue = {
  type: "cue";
  id: string;
  label: string;
};

export type ScriptBreak = { type: "break" };
export type ScriptInline = ScriptText | ScriptCue | ScriptBreak;

export type ScriptParagraph = {
  id: string;
  children: ScriptInline[];
};

export type ScriptDocument = {
  version: 1;
  paragraphs: ScriptParagraph[];
};

export function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function textInline(text: string, marks: { bold?: boolean; italic?: boolean; slow?: boolean } = {}): ScriptText {
  return { type: "text", text, ...(marks.bold ? { bold: true } : {}), ...(marks.italic ? { italic: true } : {}), ...(marks.slow ? { slow: true } : {}) };
}

function splitLegacyCues(child: ScriptText, idPrefix: string): ScriptInline[] {
  const result: ScriptInline[] = [];
  const pattern = /\[(pause|emphasize|look up|pronounce:\s*[^\]]*)\]/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(child.text))) {
    if (match.index > cursor) result.push(textInline(child.text.slice(cursor, match.index), child));
    result.push({ type: "cue", id: makeId(idPrefix), label: match[1].trim() });
    cursor = match.index + match[0].length;
  }
  if (cursor < child.text.length || !result.length) result.push(textInline(child.text.slice(cursor), child));
  return result;
}

function parseInlineMarkup(value: string, idPrefix: string): ScriptInline[] {
  const result: ScriptInline[] = [];
  const pattern = /\/(bold|italic|cue)\{([^}]*)\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) result.push(textInline(value.slice(cursor, match.index)));
    if (match[1] === "cue") result.push({ type: "cue", id: makeId(idPrefix), label: match[2].trim() });
    else result.push(textInline(match[2], { [match[1]]: true }));
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push(textInline(value.slice(cursor)));
  return (result.length ? result : [textInline("")]).flatMap((child) => child.type === "text" ? splitLegacyCues(child, idPrefix) : [child]);
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function legacyHtmlToMarkup(value: string) {
  return value
    .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, "/bold{$1}")
    .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, "/italic{$1}")
    .replace(/<div[^>]*class=["'][^"']*cue[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, "/cue{$1}\n")
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "$1\n");
}

export function documentFromLegacy(body: string, fallbackCue = "") : ScriptDocument {
  const source = body.includes("<div") || body.includes("<p") ? stripHtml(legacyHtmlToMarkup(body)) : body.replace(/\r\n/g, "\n");
  const paragraphs: ScriptParagraph[] = source.split("\n").map((line, index) => {
    const cueOnly = line.match(/^\s*(?:\/cue\{([^}]*)\}|\[cue:\s*([^\]]+)\])\s*$/i);
    if (cueOnly) return { id: `paragraph-${index + 1}`, children: [{ type: "cue", id: makeId("cue"), label: (cueOnly[1] ?? cueOnly[2] ?? "").trim() }] };
    return { id: `paragraph-${index + 1}`, children: parseInlineMarkup(line, `cue-${index}`) };
  });
  if (fallbackCue.trim() && !paragraphs.some((paragraph) => paragraph.children.some((child) => child.type === "cue"))) {
    paragraphs.push({ id: `paragraph-${paragraphs.length + 1}`, children: [{ type: "cue", id: makeId("cue"), label: fallbackCue.trim() }] });
  }
  return { version: 1, paragraphs: paragraphs.length ? paragraphs : [{ id: "paragraph-1", children: [textInline("")] }] };
}

export function parseScriptDocument(value: unknown, fallbackBody = "", fallbackCue = "") {
  if (value && typeof value === "object" && (value as ScriptDocument).version === 1 && Array.isArray((value as ScriptDocument).paragraphs)) return normalizeScriptDocument(value as ScriptDocument);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.version === 1 && Array.isArray(parsed.paragraphs)) return normalizeScriptDocument(parsed as ScriptDocument);
    } catch { /* fall through to the legacy body */ }
  }
  return isolateCues(documentFromLegacy(fallbackBody, fallbackCue));
}

function isolateCues(document: ScriptDocument): ScriptDocument {
  const paragraphs = document.paragraphs.flatMap((paragraph) => {
    if (!paragraph.children.some((child) => child.type === "cue")) return [paragraph];
    const lines: ScriptParagraph[] = [];
    let children: ScriptInline[] = [];
    const addLine = (line: ScriptInline[]) => lines.push({
      id: lines.length ? makeId("paragraph") : paragraph.id,
      children: line,
    });
    for (const child of paragraph.children) {
      if (child.type === "cue") {
        if (children.some((part) => part.type !== "text" || part.text.length)) addLine(children);
        addLine([child]);
        children = [];
      } else {
        children.push(child);
      }
    }
    if (children.some((part) => part.type !== "text" || part.text.length)) addLine(children);
    return lines;
  });
  return { version: 1, paragraphs };
}

function normalizeScriptDocument(document: ScriptDocument): ScriptDocument {
  const paragraphs: ScriptParagraph[] = document.paragraphs.map((paragraph, paragraphIndex) => ({
    id: typeof paragraph.id === "string" && paragraph.id ? paragraph.id : `paragraph-${paragraphIndex + 1}`,
    children: Array.isArray(paragraph.children) && paragraph.children.length
      ? paragraph.children.flatMap<ScriptInline>((child) => {
        if (child?.type === "cue" && typeof child.label === "string") return [{ type: "cue" as const, id: child.id || makeId("cue"), label: child.label }];
        if (child?.type === "break") return [{ type: "break" as const }];
        if (child?.type === "text" && typeof child.text === "string") return splitLegacyCues(child, `cue-${paragraphIndex}`);
        return [];
      })
      : [{ type: "text" as const, text: "" }],
  }));
  return isolateCues({ version: 1, paragraphs: paragraphs.length ? paragraphs : [{ id: "paragraph-1", children: [{ type: "text", text: "" }] }] });
}

export function documentToSpokenText(document: ScriptDocument) {
  return document.paragraphs.map((paragraph) => paragraph.children.map((child) => child.type === "cue" ? "" : child.type === "break" ? "\n" : child.text).join("")).join("\n");
}

export function documentToWordCount(document: ScriptDocument) {
  return documentToSpokenText(document).trim().split(/\s+/).filter(Boolean).length;
}

export function documentToDuration(document: ScriptDocument, wordsPerMinute = 130) {
  const seconds = Math.round(documentToWordCount(document) / wordsPerMinute * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function documentCueCount(document: ScriptDocument) {
  return document.paragraphs.reduce((total, paragraph) => total + paragraph.children.filter((child) => child.type === "cue").length, 0);
}

export function documentFirstCueLabel(document: ScriptDocument) {
  for (const paragraph of document.paragraphs) {
    const cue = paragraph.children.find((child): child is ScriptCue => child.type === "cue");
    if (cue && cue.label.trim()) return cue.label.trim();
  }
  return "";
}

export function emptyDocument(): ScriptDocument {
  return { version: 1, paragraphs: [{ id: makeId("paragraph"), children: [{ type: "text", text: "" }] }] };
}

/**
 * Splits spoken prose into sentences, keeping terminal punctuation with each sentence. A boundary is
 * terminal punctuation, whitespace, then a capital, digit, or opening quote — so "74.5%" and
 * "e.g. this" stay intact.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?…]["'”’)\]]*)\s+(?=["“‘(\[]?[A-Z0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export type AiCuePlacement = { paragraph: number; afterSentence: number; label: string };
export type AiTextMark = { paragraph: number; text: string; mark: "bold" | "slow" };

/** Splits a line into runs, formatting the first occurrence of each mark's text. Unmatched marks are ignored. */
function markedRuns(line: string, marks: AiTextMark[], used: Set<AiTextMark>): ScriptText[] {
  const flags = Array.from({ length: line.length }, () => ({ bold: false, slow: false }));
  for (const mark of marks) {
    const start = mark.text ? line.indexOf(mark.text) : -1;
    if (used.has(mark) || start < 0) continue;
    used.add(mark);
    for (let index = start; index < start + mark.text.length; index += 1) flags[index][mark.mark] = true;
  }
  const runs: ScriptText[] = [];
  let start = 0;
  for (let index = 1; index <= line.length; index += 1) {
    const same = index < line.length && flags[index].bold === flags[start].bold && flags[index].slow === flags[start].slow;
    if (same) continue;
    runs.push(textInline(line.slice(start, index), flags[start]));
    start = index;
  }
  return runs.length ? runs : [textInline(line)];
}

/**
 * Builds a script document from AI prose. Cues are anchored after a one-based sentence of a
 * one-based paragraph (0 = before its first sentence) and become their own cue line, matching how
 * the editor isolates cues. Marks bold or slow a phrase within their paragraph.
 */
export function documentFromAi(paragraphs: string[], cues: AiCuePlacement[] = [], marks: AiTextMark[] = []): ScriptDocument {
  const result: ScriptParagraph[] = [];
  const cleaned = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
  const used = new Set<AiTextMark>();
  const cueLines = (list: AiCuePlacement[]) => {
    for (const cue of list) result.push({ id: makeId("paragraph"), children: [{ type: "cue", id: makeId("cue"), label: cue.label.trim() }] });
  };
  cleaned.forEach((paragraph, paragraphIndex) => {
    const sentences = splitSentences(paragraph);
    const anchored = cues.filter((cue) => cue.label.trim() && Math.min(Math.max(cue.paragraph, 1), cleaned.length) === paragraphIndex + 1);
    const paragraphMarks = marks.filter((mark) => mark.paragraph === paragraphIndex + 1);
    const at = (cue: AiCuePlacement) => Math.min(Math.max(Math.round(cue.afterSentence) || 0, 0), sentences.length);
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) result.push({ id: makeId("paragraph"), children: markedRuns(buffer.join(" "), paragraphMarks, used) });
      buffer = [];
    };
    cueLines(anchored.filter((cue) => at(cue) === 0));
    sentences.forEach((sentence, sentenceIndex) => {
      buffer.push(sentence);
      const here = anchored.filter((cue) => at(cue) === sentenceIndex + 1);
      if (here.length) {
        flush();
        cueLines(here);
      }
    });
    flush();
  });
  return result.length ? { version: 1, paragraphs: result } : emptyDocument();
}

/** Spoken paragraphs with cue lines removed and adjacent prose lines kept separate. */
export function documentToParagraphs(document: ScriptDocument): string[] {
  return document.paragraphs
    .map((paragraph) => paragraph.children.map((child) => child.type === "text" ? child.text : child.type === "break" ? " " : "").join("").trim())
    .filter(Boolean);
}

export function documentSentences(document: ScriptDocument): string[] {
  return documentToParagraphs(document).flatMap(splitSentences);
}

export function documentCues(document: ScriptDocument): ScriptCue[] {
  return document.paragraphs.flatMap((paragraph) => paragraph.children.filter((child): child is ScriptCue => child.type === "cue"));
}

/** Plain-text export: prose as written, cues rendered as bracketed private notes. */
export function documentToPlainText(document: ScriptDocument, { includeCues = true } = {}): string {
  return document.paragraphs
    .map((paragraph) => paragraph.children.map((child) => {
      if (child.type === "cue") return includeCues ? `[${child.label}]` : "";
      if (child.type === "break") return "\n";
      return child.text;
    }).join("").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function wordsToSeconds(words: number, wordsPerMinute: number) {
  return Math.round((words / Math.max(40, wordsPerMinute)) * 60);
}
