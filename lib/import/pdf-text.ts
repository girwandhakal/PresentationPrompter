/**
 * Turning pdf.js text runs into slide text and a title guess. Kept apart from the renderer so it can
 * be tested without a browser or a PDF.
 */

export type TextItem = { str: string; hasEOL: boolean; height: number; transform: number[] };

export function itemsToText(items: TextItem[]) {
  let text = "";
  for (const item of items) {
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/** A headline this many times larger than anything in the upper part of the page wins over that text. */
const LOWER_TITLE_RATIO = 3;

/**
 * The largest text in the upper part of the page is usually the slide title. Title slides often set
 * theirs lower down, under a small header; then the page's largest text is the title instead.
 */
export function guessTitle(items: TextItem[], pageHeight: number) {
  const visible = items.filter((item) => item.str.trim() && item.height > 0);
  if (!visible.length) return "";
  const upper = visible.filter((item) => item.transform[5] > pageHeight * 0.35);
  const upperMax = upper.length ? Math.max(...upper.map((item) => item.height)) : 0;
  const overallMax = Math.max(...visible.map((item) => item.height));
  const useUpper = upperMax > 0 && overallMax < upperMax * LOWER_TITLE_RATIO;
  const pool = useUpper ? upper : visible;
  const max = useUpper ? upperMax : overallMax;
  const title = pool
    .filter((item) => item.height >= max * 0.9)
    .map((item) => item.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return title.length > 140 ? `${title.slice(0, 137)}…` : title;
}

export function firstLine(text: string) {
  const line = text.split("\n").find((value) => value.trim())?.trim() ?? "";
  return line.length > 100 ? `${line.slice(0, 97)}…` : line;
}
