import type { BriefInput, RewriteRequest, WriteRequest, WriteSlideInput } from "../schemas";

/**
 * Cheap, deterministic checks for script text that reads like slide notes instead of speech, uses
 * sales-deck language, or states figures the source material doesn't contain. Prompts alone are
 * not consistent enough, so the OpenAI provider runs these on each draft and asks the model to redo
 * any slide that fails.
 */

// One to three words then a colon, at the start of a sentence: "Keep:", "Short version:", "Iteration 1 goal:".
// A signpost ahead of the label doesn't make it speech: "Second, external dependencies: …".
const LABEL_OPENER = /(^|[.!?]\s+)(?:(?:First|Second|Third|Next|Then|Finally|Also|Lastly),\s+)?[A-Za-z][A-Za-z0-9’']*(?: [A-Za-z0-9’']+){0,2}:\s+\S/;
// A real spoken sentence with a colon ("Here's the thing: …", "We did it: …") contains one of these.
const SPOKEN_WORDS = /\b(?:the|we|i|it|is|was|are|were|here's|that's|so|and|to)\b/i;
const ID_REFERENCE = /(?:#|PR\s?#?)\d+/gi;
// Sales-deck filler the voice rules forbid; one hit is enough to ask for a rewrite.
const HYPE = /\b(?:game[- ]?changer|game[- ]changing|revolutionary|revolutioni[sz]e|cutting[- ]edge|groundbreaking|world[- ]class|best[- ]in[- ]class|next[- ]level|synergy|synergies|delve|unlock the (?:full )?(?:power|potential)|in today's fast[- ]paced|supercharge|thrilled to)\b/i;
// A figure in the script: digits with optional decimals, thousands separators or a percent sign. Ticket ids are not figures.
const FIGURE = /(?<![#\w.])\d[\d,]*(?:\.\d+)?/g;
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

const numberKey = (value: string) => String(Number(value.replace(/,/g, "")));

/** Every number the source material mentions, as digits or number words. */
function sourceNumbers(source: string) {
  const found = new Set((source.match(FIGURE) ?? []).map(numberKey));
  for (const word of source.toLowerCase().match(/[a-z]+/g) ?? []) if (word in NUMBER_WORDS) found.add(String(NUMBER_WORDS[word]));
  return found;
}

/**
 * Figures in the script that appear nowhere in the slide, notes, analysis or brief. Small counts
 * ("two things", "3 steps") are left alone: presenters count what's on a slide.
 */
export function ungroundedFigures(paragraphs: string[], source: string) {
  const known = sourceNumbers(source);
  const figures = paragraphs.join(" ").match(FIGURE) ?? [];
  return [...new Set(figures.filter((figure) => {
    const value = Number(figure.replace(/,/g, ""));
    return !(Number.isInteger(value) && value <= 10) && !known.has(numberKey(figure));
  }))];
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

/**
 * Returns human-readable problems; an empty array means the text sounds spoken enough. With
 * `source` (everything the script may draw on), figures that don't trace back to it are problems too.
 */
export function spokenProblems(paragraphs: string[], source?: string): string[] {
  const text = paragraphs.join(" ").trim();
  if (!text) return [];
  const problems: string[] = [];

  const label = paragraphs
    .map((paragraph) => LABEL_OPENER.exec(paragraph)?.[0].trim())
    .find((match) => match && !SPOKEN_WORDS.test(match.replace(/^[.!?]\s*/, "")));
  if (label) problems.push(`It uses a slide-style label with a colon ("${label.replace(/^[.!?]\s*/, "")}…"). Speech doesn't announce labels; fold the idea into a sentence.`);

  const all = sentences(text);
  if (all.length >= 3) {
    const average = words(text) / all.length;
    if (average < 7) problems.push(`Its sentences average ${average.toFixed(1)} words, which reads as clipped notes. Use complete sentences of roughly 10–20 words.`);
  }

  const ids = text.match(ID_REFERENCE)?.length ?? 0;
  if (ids >= 3) problems.push(`It recites ${ids} ticket or PR numbers. Name at most one or two and summarize the rest in words.`);

  const hype = HYPE.exec(text)?.[0];
  if (hype) problems.push(`It uses sales-deck language ("${hype}"). Say it plainly, the way you'd explain it to a colleague.`);

  const invented = source == null ? [] : ungroundedFigures(paragraphs, source);
  if (invented.length) problems.push(`It states ${invented.map((figure) => `"${figure}"`).join(", ")}, which isn't in the slide, notes, or brief. Use only figures from the material, or describe the point without a number.`);

  return problems;
}

type SourceSlide = Pick<WriteSlideInput, "title" | "text" | "notes" | "analysis">;

function materials(brief: BriefInput, slide: SourceSlide, extra: string[]) {
  return [
    brief.goal, brief.audience, brief.keyMessage, brief.mustInclude, brief.presenterRole, `${brief.minutes} minutes`,
    slide.title, slide.text, slide.notes, slide.analysis?.mainPoint ?? "", slide.analysis?.visualSummary ?? "",
    ...(slide.analysis?.elements.map((element) => element.label) ?? []),
    ...extra,
  ].join("\n");
}

/** Per slide, everything a written script may draw its figures from. */
export function writeSources(request: WriteRequest) {
  const deck = request.context?.summary ?? "";
  return new Map(request.slides.map((slide) => [slide.id, materials(request.brief, slide, [deck, slide.keyIdea, slide.role, slide.transition])]));
}

/** For a rewrite, the slide material plus the presenter's current script, which may carry their own figures. */
export function rewriteSource(request: Extract<RewriteRequest, { kind: "script" }>) {
  return materials(request.brief, request.slide, request.paragraphs);
}

type DraftSlide = { id: string; paragraphs: string[]; concise: string };

/**
 * Slides in a written draft that read like notes or state figures not in their source: their
 * paragraphs, plus label-style openers in the concise summary.
 */
export function draftProblems(slides: DraftSlide[], sources: Map<string, string> = new Map()): { id: string; problems: string[] }[] {
  return slides.flatMap((slide) => {
    const problems = [...spokenProblems(slide.paragraphs, sources.get(slide.id)), ...spokenProblems([slide.concise]).filter((problem) => problem.includes("label"))];
    return problems.length ? [{ id: slide.id, problems }] : [];
  });
}

/**
 * Merges a draft and its retry slide by slide, so a retry can never make things worse: a slide takes
 * the retry's version only when its first version had problems and the retry has no more. Slides
 * that were already fine keep their first version.
 */
export function pickDraft<T extends { slides: DraftSlide[] }>(first: T, retry: T | null, sources: Map<string, string> = new Map()): T {
  if (!retry) return first;
  const count = (slide: DraftSlide) => draftProblems([slide], sources)[0]?.problems.length ?? 0;
  const retried = new Map(retry.slides.map((slide) => [slide.id, slide]));
  return {
    ...first,
    slides: first.slides.map((slide) => {
      const other = retried.get(slide.id);
      const problems = count(slide);
      return other && other.paragraphs.length && problems && count(other) <= problems ? other : slide;
    }),
  };
}
