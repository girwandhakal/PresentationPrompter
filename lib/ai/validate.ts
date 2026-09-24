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

const MAX_CUES: Record<BriefInput["cueDensity"], number> = { none: 0, light: 2, detailed: 4 };

function clean(value: string, max: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

export function sentenceCount(paragraph: string) {
  return (paragraph.match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? []).filter((part) => part.trim()).length;
}

type Cue = WrittenSlideOutput["cues"][number];

export function sanitizeCues(cues: Cue[], paragraphs: string[], density: BriefInput["cueDensity"]): Cue[] {
  if (!paragraphs.length) return [];
  return cues
    .filter((cue) => cue.text.trim())
    .slice(0, MAX_CUES[density])
    .map((cue) => {
      const paragraph = Math.min(Math.max(1, Math.round(cue.paragraph) || 1), paragraphs.length);
      const sentences = Math.max(1, sentenceCount(paragraphs[paragraph - 1]));
      return { ...cue, paragraph, afterSentence: Math.min(Math.max(1, Math.round(cue.afterSentence) || 1), sentences), text: clean(cue.text, 90) };
    });
}

export function sanitizeParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

const NUMBER_PATTERN = /(?<![\w.])(?:[$€£¥])?\d[\d,]*(?:\.\d+)?(?:\s?%|x\b|k\b|m\b|bn\b)?/gi;

function normalizeNumber(value: string) {
  return value.toLowerCase().replace(/[$€£¥,\s]/g, "").replace(/\.0+(?=%|$)/, "");
}

/**
 * Numbers in the script that appear nowhere in the source material are flagged for review,
 * never silently removed. Small counting words ("3 steps") are allowed when the source lists that
 * many items, so only multi-digit figures, decimals, percentages, and currency are checked.
 */
export function ungroundedNumbers(paragraphs: string[], sources: string[]) {
  const haystack = new Set((sources.join(" ").match(NUMBER_PATTERN) ?? []).map(normalizeNumber));
  const spelled = sources.join(" ").toLowerCase();
  const found = new Set<string>();
  for (const match of paragraphs.join(" ").match(NUMBER_PATTERN) ?? []) {
    const normalized = normalizeNumber(match);
    const bare = normalized.replace(/[%xkmbn]+$/, "");
    const significant = /[%.$€£¥]/.test(match) || bare.length >= 2;
    if (!significant) continue;
    if (haystack.has(normalized) || haystack.has(bare) || spelled.includes(bare)) continue;
    found.add(match.trim());
  }
  return [...found];
}

export function briefSources(brief: BriefInput) {
  return [brief.goal, brief.audience, brief.keyMessage, brief.mustInclude, brief.presenterRole];
}

/** Normalizes one written slide against its input and the brief. */
export function finalizeWrittenSlide(output: WrittenSlideOutput, input: WriteSlideInput, brief: BriefInput): WrittenSlideOutput {
  const paragraphs = sanitizeParagraphs(output.paragraphs);
  const flags = output.flags
    .filter((flag) => flag.message.trim())
    .map((flag) => ({ ...flag, message: clean(flag.message, 240) }));

  const sources = [input.title, input.text, input.notes, input.analysis?.visualSummary ?? "", input.analysis?.mainPoint ?? "", ...briefSources(brief)];
  const numbers = ungroundedNumbers(paragraphs, sources);
  if (numbers.length) {
    flags.push({ kind: "unsupported-claim", message: `Check ${numbers.slice(0, 4).map((value) => `“${value}”`).join(", ")}: not found on the slide or in your brief.` });
  }

  return {
    id: input.id,
    purpose: clean(output.purpose, 300),
    paragraphs,
    cues: sanitizeCues(output.cues, paragraphs, brief.cueDensity),
    concise: clean(output.concise, 500),
    keywords: output.keywords.map((keyword) => clean(keyword, 60)).filter(Boolean).slice(0, 6),
    recovery: clean(output.recovery, 300),
    transition: clean(output.transition, 300),
    questions: brief.includeQuestions
      ? output.questions.filter((question) => question.question.trim()).slice(0, 4).map((question) => ({ question: clean(question.question, 300), answer: clean(question.answer, 600) }))
      : [],
    flags: dedupeFlags(flags),
  };
}

function dedupeFlags<T extends { kind: string; message: string }>(flags: T[]) {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.kind}:${flag.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

export function clampComplexity(value: number) {
  return Math.min(5, Math.max(1, Math.round(Number.isFinite(value) ? value : 3)));
}
