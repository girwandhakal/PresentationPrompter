import type { BriefInput, WriteSlideInput, WrittenSlideOutput } from "./schemas";

/**
 * Deterministic checks applied to every model response before it reaches the presenter.
 * Pure functions: shared by the server routes, the demo provider, and unit tests.
 */

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function paragraphsWords(paragraphs: string[]) {
  return paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0);
}

/** How far from target a slide may land before the rebalance dialog offers to fit it. */
export const FIT_TOLERANCE: Record<BriefInput["depth"], number> = { full: 0.2, notes: 0.35, cues: 0.6 };

export function needsRepair(words: number, target: number, depth: BriefInput["depth"]) {
  if (target < 15) return false;
  return Math.abs(words / target - 1) > FIT_TOLERANCE[depth];
}

function clean(value: string, max: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

export function sanitizeParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => {
      const text = paragraph.replace(/\s+/g, " ").trim();
      // Models sometimes wrap a whole paragraph in quotes; a quotation inside prose is kept intact.
      const wrapped = /^["“].*["”]$/.test(text) && !/["“”]/.test(text.slice(1, -1));
      return wrapped ? text.slice(1, -1).trim() : text;
    })
    .filter(Boolean)
    .slice(0, 8);
}

// A short spoken lead-in ("So, hello…") still counts, so a conversational rewrite isn't greeted twice.
const GREETING = /^(?:(?:so|well|ok(?:ay)?|alright|right),? )?(?:hello|hi|hey|good (?:morning|afternoon|evening)|welcome|greetings)\b/i;
const THANKS = /\bthank(?:s| you)\b/i;

/**
 * The talk opens with a greeting on its first slide and closes with thanks on its last, whatever
 * the model wrote. Full scripts get the line inside the paragraph; notes and cues get their own line.
 */
export function frameTalk(paragraphs: string[], { first, last }: { first: boolean; last: boolean }, depth: BriefInput["depth"]) {
  const result = [...paragraphs];
  const inline = depth === "full" && result.length > 0;
  if (first && !GREETING.test(result[0] ?? "")) {
    if (inline) result[0] = `Hello, everyone. ${result[0]}`;
    else result.unshift("Hello, everyone.");
  }
  if (last && !THANKS.test(result.at(-1) ?? "")) {
    if (inline) result[result.length - 1] = `${result.at(-1)} Thank you, everyone.`;
    else result.push("Thank you, everyone.");
  }
  return result;
}

/**
 * Normalizes one written slide against its input and the brief. With `position`, the first and
 * last slides of the talk get their greeting and thanks. The script is plain prose: no cues or marks.
 */
export function finalizeWrittenSlide(output: WrittenSlideOutput, input: WriteSlideInput, brief: BriefInput, position?: { first: boolean; last: boolean }): WrittenSlideOutput {
  const sanitized = sanitizeParagraphs(output.paragraphs);
  const paragraphs = position && sanitized.length ? frameTalk(sanitized, position, brief.depth) : sanitized;
  return {
    id: input.id,
    purpose: clean(output.purpose, 300),
    paragraphs,
    concise: clean(output.concise, 500),
    keywords: output.keywords.map((keyword) => clean(keyword, 60)).filter(Boolean).slice(0, 6),
    recovery: clean(output.recovery, 300),
    transition: clean(output.transition, 300),
    questions: brief.includeQuestions
      ? output.questions.filter((question) => question.question.trim()).slice(0, 4).map((question) => ({ question: clean(question.question, 300), answer: clean(question.answer, 600) }))
      : [],
  };
}

export function clampComplexity(value: number) {
  return Math.min(5, Math.max(1, Math.round(Number.isFinite(value) ? value : 3)));
}
