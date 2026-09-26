import { placeCues } from "../domain/cues";
import type { BriefInput, WriteSlideInput, WrittenSlideDraft, WrittenSlideOutput } from "./schemas";

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

/** How far from target a slide may land before an automatic repair pass is attempted. */
export const FIT_TOLERANCE: Record<BriefInput["depth"], number> = { full: 0.2, notes: 0.35, cues: 0.6 };

export function fitRatio(words: number, target: number) {
  if (target <= 0) return 1;
  return words / target;
}

export function needsRepair(words: number, target: number, depth: BriefInput["depth"]) {
  if (target < 15) return false;
  return Math.abs(fitRatio(words, target) - 1) > FIT_TOLERANCE[depth];
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

/** Normalizes one written slide against its input and the brief, and places its delivery cues. */
export function finalizeWrittenSlide(output: WrittenSlideDraft, input: WriteSlideInput, brief: BriefInput): WrittenSlideOutput {
  const paragraphs = sanitizeParagraphs(output.paragraphs);
  return {
    id: input.id,
    purpose: clean(output.purpose, 300),
    paragraphs,
    cues: placeCues({
      paragraphs,
      density: brief.cueDensity,
      seed: input.id,
      keyIdea: input.keyIdea || input.analysis?.mainPoint,
      elements: input.analysis?.elements,
      kind: input.analysis?.kind,
      first: input.index === 1,
      last: !input.nextTitle,
    }),
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
