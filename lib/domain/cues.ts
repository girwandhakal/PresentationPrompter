import { splitSentences } from "./script";

/**
 * Places delivery cues in finished script prose. Code, not the model, decides where cues go: the
 * model tended to anchor every cue after the first sentence, while a coach pauses before a key
 * figure, after a question or the slide's main point, at a turn in the argument, or when pointing
 * at the visual. Each gap between sentences is scored from what the text says, then the best gaps
 * are picked within the density budget. Same text and seed in, same cues out.
 */

export const CUE_TYPES = ["pause", "emphasis", "look", "gesture", "breathe", "slow", "transition", "check"] as const;
export type CueType = (typeof CUE_TYPES)[number];
export type CueDensity = "none" | "light" | "detailed";

/** Anchored after sentence `afterSentence` of a one-based paragraph; 0 means before its first sentence. */
export type PlacedCue = { paragraph: number; afterSentence: number; type: CueType; text: string };

export type CueContext = {
  paragraphs: string[];
  density: CueDensity;
  /** Stable per slide, e.g. its id: placement varies between slides but not between reruns. */
  seed: string;
  keyIdea?: string;
  elements?: { label: string }[];
  kind?: string;
  first?: boolean;
  last?: boolean;
};

type Sentence = { paragraph: number; index: number; text: string; words: number; opensParagraph: boolean };
/** `gap` g sits before sentence g (0 is the slide start), so the gap after the final sentence never exists. */
type Candidate = { gap: number; type: CueType; labels: string[]; score: number };

const THRESHOLD: Record<CueDensity, number> = { none: Infinity, light: 3, detailed: 2 };

function budget(density: CueDensity, words: number) {
  if (density === "light") return words >= 160 ? 2 : 1;
  if (density === "detailed") return Math.min(4, Math.max(2, Math.round(words / 45)));
  return 0;
}

const STOP = new Set("that this with from have will they them their there what when where which about into your ours just than then very more most also been were because these those some such only over".split(" "));

function stems(text: string) {
  return new Set((text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])
    .filter((word) => word.length > 3 && !STOP.has(word))
    .map((word) => word.replace(/(?:ing|ed|es|s)$/, "")));
}

function overlap(source: Set<string>, sentence: Set<string>) {
  if (!source.size) return 0;
  let shared = 0;
  for (const word of source) if (sentence.has(word)) shared += 1;
  return shared / source.size;
}

// A figure worth stressing: currency, percentages, multipliers, or counted units. Ticket ids (#42) are not.
const STRONG_FIGURE = /(?<![#\w])(?:[$€£]\s?\d[\d,.]*(?:\s?(?:k|m|bn|million|billion))?|\d[\d,.]*\s?(?:%|percent|x\b|times\b|million|billion|thousand|hours?|days?|weeks?|months?|years?|minutes?|seconds?|users|people|customers|students))/i;
const WORD_FIGURE = /\b(?:half|double[ds]?|twice|triple[ds]?|tenfold|a third|a quarter)\b/i;
const IMPORTANT = /\b(?:most important|the key (?:point|thing|takeaway|idea)|the one thing|remember this|what matters|bottom line|the point is|biggest|critical|crucial)\b/i;
const TURN = /^(?:but|however|yet|instead|still|so what|here's the thing|the catch|the problem|the good news|the bad news|that said|in other words|what that means|the result)\b/i;
const DEICTIC = /\b(?:you can see|as you see|on the (?:left|right)|at the (?:top|bottom)|this (?:chart|graph|diagram|table|map|screenshot|photo|image)|the (?:chart|graph|diagram|table|screenshot)|on (?:the )?screen|on the slide)\b/i;
const VISUAL_KINDS = new Set(["chart", "diagram", "table"]);

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shortLabel(label: string) {
  return label.replace(/[()[\]"“”]/g, "").trim().split(/\s+/).slice(0, 3).join(" ");
}

// A plain count ("29 tests") is worth less. Years, dates, and ticket ids are skipped.
const PLAIN_FIGURE = /(?<![#\w.,])(?!(?:19|20)\d\d\b)\d{2,}(?:[.,]\d+)?\b(?!\s?(?:st|nd|rd|th)\b)/;
const MONTH_BEFORE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+$/i;

function figure(text: string) {
  const strong = STRONG_FIGURE.exec(text)?.[0] ?? WORD_FIGURE.exec(text)?.[0];
  if (strong) return strong.trim();
  const plain = PLAIN_FIGURE.exec(text);
  return plain && !MONTH_BEFORE.test(text.slice(0, plain.index)) ? plain[0] : "";
}

function candidates(sentences: Sentence[], context: CueContext): Candidate[] {
  const result: Candidate[] = [];
  const add = (gap: number, type: CueType, score: number, ...labels: string[]) => {
    if (gap >= 0 && gap < sentences.length) result.push({ gap, type, labels, score });
  };
  const lastIndex = sentences.length - 1;
  const key = stems(context.keyIdea ?? "");
  const elements = (context.elements ?? []).map((element) => ({ label: element.label, stems: stems(element.label) })).filter((element) => element.stems.size);

  // The slide start: a new visual needs a moment before the presenter talks over it.
  if (context.kind && VISUAL_KINDS.has(context.kind)) add(0, "look", 3.5, `Let them read the ${context.kind}`, "Give the slide a moment");
  else if (context.kind === "image") add(0, "look", 2.5, "Let the image land");
  else if (context.first) add(0, "breathe", 3, "Breathe, then begin");

  // The sentence closest to the slide's key idea gets room to land. Title and section slides only greet.
  if (key.size >= 2 && context.kind !== "title" && context.kind !== "section") {
    const scored = sentences.map((sentence, index) => ({ index, ratio: overlap(key, stems(sentence.text)) }));
    const best = scored.reduce((top, entry) => entry.ratio > top.ratio ? entry : top, { index: -1, ratio: 0 });
    if (best.index >= 0 && best.ratio >= 0.34) {
      if (best.index < lastIndex) add(best.index + 1, "pause", 2.5 + 1.5 * best.ratio, "Pause, let it land", "Let that sink in", "Pause here");
      else add(best.index, "slow", 2 + 1.5 * best.ratio, "Slow down for this", "Land this line");
    }
  }

  sentences.forEach((sentence, index) => {
    const text = sentence.text;
    const words = stems(text);

    const value = figure(text);
    if (value) add(index, "emphasis", STRONG_FIGURE.test(text) ? 4 : WORD_FIGURE.test(text) ? 3 : 2.5, `Stress ${value}`);
    else if (IMPORTANT.test(text)) add(index, "emphasis", 3, "Stress this line", "Land this point");

    if (text.endsWith("?") && index < lastIndex) add(index + 1, "pause", 4, "Let the question sit", "Pause for the question");

    if (index > 0 && TURN.test(text)) add(index, "pause", sentence.opensParagraph ? 3 : 2.5, "Brief pause", "Pause before the turn");

    const element = elements.find((candidate) => overlap(candidate.stems, words) >= 0.6);
    if (element) add(index, "gesture", 3.5, `Point to ${shortLabel(element.label)}`);
    else if (DEICTIC.test(text)) add(index, "gesture", 3, "Gesture to the slide");

    if (index > 0 && sentence.words >= 28) add(index, "slow", 2, "Slow down here", "Take this slowly");

    if (sentence.opensParagraph && index > 0) {
      const previous = sentences.filter((item) => item.paragraph === sentence.paragraph - 1).reduce((sum, item) => sum + item.words, 0);
      if (previous >= 50) add(index, "breathe", 2, "Breathe", "Take a breath");
      else add(index, "look", 1.5, "Look up at the room", "Eyes on the room");
    }
  });

  if (context.last && sentences.length > 1) add(lastIndex, "look", 3, "Look up to close");

  return result;
}

export function placeCues(context: CueContext): PlacedCue[] {
  if (context.density === "none") return [];
  const sentences: Sentence[] = context.paragraphs.flatMap((paragraph, paragraphIndex) =>
    splitSentences(paragraph).map((text, index) => ({
      paragraph: paragraphIndex + 1,
      index: index + 1,
      text,
      words: text.split(/\s+/).filter(Boolean).length,
      opensParagraph: index === 0,
    })));
  if (!sentences.length) return [];

  const words = sentences.reduce((sum, sentence) => sum + sentence.words, 0);
  const limit = budget(context.density, words);
  // A small seeded jitter breaks ties differently on each slide, so equal-looking slides don't get identical rhythm.
  const pool = candidates(sentences, context).map((candidate) => ({
    ...candidate,
    score: candidate.score + (hash(`${context.seed}:${candidate.gap}:${candidate.type}`) % 1000) / 1000 * 0.6,
  }));

  const chosen: typeof pool = [];
  while (chosen.length < limit) {
    let best: (typeof pool)[number] | null = null;
    let bestScore = -Infinity;
    for (const candidate of pool) {
      // At least one full sentence between cues; a repeated type on the same slide is less useful.
      if (chosen.some((pick) => Math.abs(pick.gap - candidate.gap) < 2)) continue;
      const score = candidate.score - (chosen.some((pick) => pick.type === candidate.type) ? 1 : 0);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best || bestScore < THRESHOLD[context.density]) break;
    chosen.push(best);
  }

  return chosen
    .sort((a, b) => a.gap - b.gap)
    .map((cue) => {
      const text = cue.labels[hash(`${context.seed}:${cue.type}`) % cue.labels.length];
      if (cue.gap === 0) return { paragraph: 1, afterSentence: 0, type: cue.type, text };
      const previous = sentences[cue.gap - 1];
      return { paragraph: previous.paragraph, afterSentence: previous.index, type: cue.type, text };
    });
}
