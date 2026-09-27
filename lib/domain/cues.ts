import { splitSentences } from "./script";

/**
 * Delivery guidance for finished script prose. Only pauses get their own cue line; stress is
 * shown by bolding a word or phrase, and pace by marking a sentence slow.
 *
 * An AI speech coach answers narrow, factual questions about each numbered sentence (is it a
 * question to the room? the slide's main point? a turn? must it be caught word for word? which
 * words carry the stress?). Fixed rules then turn those facts into
 * guidance (`applySentenceNotes`), so the judgment calls are the model's and the placement is
 * calculated. When the coach is unavailable, text heuristics stand in for its answers
 * (`placeDelivery`).
 */

export const CUE_TYPES = ["pause"] as const;
export type CueType = (typeof CUE_TYPES)[number];
export type CueDensity = "none" | "light" | "detailed";
export type MarkType = "bold" | "slow";

/** Anchored after sentence `afterSentence` of a one-based paragraph; 0 means before its first sentence. */
export type PlacedCue = { paragraph: number; afterSentence: number; type: CueType; text: string };
/** Formats `text` inside one-based sentence `sentence` of one-based paragraph `paragraph`. */
export type PlacedMark = { paragraph: number; sentence: number; text: string; mark: MarkType };

export type DeliveryContext = {
  paragraphs: string[];
  density: CueDensity;
  /** Stable per slide, e.g. its id: placement varies between slides but not between reruns. */
  seed: string;
  title?: string;
  keyIdea?: string;
  kind?: string;
};

export type Sentence = { paragraph: number; index: number; text: string; words: number; opensParagraph: boolean };
/** `gap` g sits before sentence g (0 is the slide start), so the gap after the final sentence never exists. */
type Candidate = { gap: number; type: CueType; text: string; score: number };
type MarkCandidate = { sentence: number; text: string; mark: MarkType; score: number };

const THRESHOLD: Record<CueDensity, number> = { none: Infinity, light: 3, detailed: 2 };

function cueBudget(density: CueDensity, words: number) {
  if (density === "light") return words >= 160 ? 2 : 1;
  if (density === "detailed") return Math.min(4, Math.max(2, Math.round(words / 45)));
  return 0;
}

const MARK_BUDGET: Record<CueDensity, number> = { none: 0, light: 1, detailed: 2 };

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
const STRONG_FIGURE = /(?<![#\w])(?:[$€£]\s?\d[\d,.]*(?:\s?(?:k|m|bn|million|billion))?|\d[\d,.]*\s?(?:%|percent|x\b|times\b|million|billion|thousand|hours?|days?|weeks?|months?|years?|minutes?|seconds?|users|people|customers|students))/gi;
const WORD_FIGURE = /\b(?:half|double[ds]?|twice|triple[ds]?|tenfold|a third|a quarter)\b/i;
// A plain count ("29 tests") is worth less. Years, dates, and ticket ids are skipped.
const PLAIN_FIGURE = /(?<![#\w.,])(?!(?:19|20)\d\d\b)\d{2,}(?:[.,]\d+)?\b(?!\s?(?:st|nd|rd|th)\b)/;
const MONTH_BEFORE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+$/i;
const TURN = /^(?:but|however|yet|instead|still|so what|here's the thing|the catch|the problem|the good news|the bad news|that said|in other words|what that means|the result)\b/i;

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const jitter = (seed: string, key: string) => (hash(`${seed}:${key}`) % 1000) / 1000 * 0.6;

/** The figure a sentence turns on, and how much it deserves stress. */
function figure(text: string): { value: string; score: number } | null {
  const strong = text.match(STRONG_FIGURE);
  if (strong) return { value: strong[0].trim(), score: 4 };
  const word = WORD_FIGURE.exec(text);
  if (word) return { value: word[0], score: 3 };
  const plain = PLAIN_FIGURE.exec(text);
  return plain && !MONTH_BEFORE.test(text.slice(0, plain.index)) ? { value: plain[0], score: 2.5 } : null;
}

function keySentence(sentences: Sentence[], context: DeliveryContext) {
  const key = stems(context.keyIdea ?? "");
  // Title and section slides only greet; there is no point to land.
  if (key.size < 2 || context.kind === "title" || context.kind === "section") return null;
  const best = sentences
    .map((sentence, index) => ({ index, ratio: overlap(key, stems(sentence.text)) }))
    .reduce((top, entry) => entry.ratio > top.ratio ? entry : top, { index: -1, ratio: 0 });
  return best.index >= 0 && best.ratio >= 0.34 ? best : null;
}

function cueCandidates(sentences: Sentence[], context: DeliveryContext): Candidate[] {
  const result: Candidate[] = [];
  const pause = (gap: number, score: number) => {
    if (gap >= 0 && gap < sentences.length) result.push({ gap, type: "pause", text: "Pause", score });
  };
  const lastIndex = sentences.length - 1;

  const key = keySentence(sentences, context);
  if (key && key.index < lastIndex) pause(key.index + 1, 2.5 + 1.5 * key.ratio);

  sentences.forEach((sentence, index) => {
    if (sentence.text.endsWith("?") && index < lastIndex) pause(index + 1, 4);
    if (index > 0 && TURN.test(sentence.text)) pause(index, sentence.opensParagraph ? 3 : 2.5);
    if (index > 0 && sentence.opensParagraph) {
      const previous = sentences.filter((item) => item.paragraph === sentence.paragraph - 1).reduce((sum, item) => sum + item.words, 0);
      if (previous >= 50) pause(index, 2);
    }
  });

  return result;
}

function markCandidates(sentences: Sentence[]): MarkCandidate[] {
  const result: MarkCandidate[] = [];
  sentences.forEach((sentence, index) => {
    const found = figure(sentence.text);
    if (found) result.push({ sentence: index, text: found.value, mark: "bold", score: found.score });

    // Slow down only for detail the audience must catch exactly, the same test the AI coach applies.
    if ((sentence.text.match(STRONG_FIGURE)?.length ?? 0) >= 2) result.push({ sentence: index, text: sentence.text, mark: "slow", score: 3.5 });
  });
  return result;
}

export type Delivery = { cues: PlacedCue[]; marks: PlacedMark[] };
const EMPTY: Delivery = { cues: [], marks: [] };

/** The script's sentences in reading order, numbered the same way everywhere (editor, engine, AI). */
export function scriptSentences(paragraphs: string[]): Sentence[] {
  return paragraphs.flatMap((paragraph, paragraphIndex) =>
    splitSentences(paragraph).map((text, index) => ({
      paragraph: paragraphIndex + 1,
      index: index + 1,
      text,
      words: text.split(/\s+/).filter(Boolean).length,
      opensParagraph: index === 0,
    })));
}

/** How much guidance a slide can carry at this density: fewer is always fine. */
export function deliveryLimits(density: CueDensity, words: number) {
  // A second slow passage on one slide dilutes the first, so one is the most at any density.
  return { cues: cueBudget(density, words), bold: MARK_BUDGET[density], slow: Math.min(1, MARK_BUDGET[density]) };
}

/**
 * The one place budgets, spacing, and anchors are enforced, whoever proposed the candidates. Higher
 * scores win; a candidate below `threshold` is never used.
 */
function select(sentences: Sentence[], density: CueDensity, cuePool: Candidate[], markPool: MarkCandidate[], threshold: number): Delivery {
  const words = sentences.reduce((sum, sentence) => sum + sentence.words, 0);
  const limits = deliveryLimits(density, words);
  const cues: Candidate[] = [];
  for (const cue of [...cuePool].sort((a, b) => b.score - a.score)) {
    if (cues.length >= limits.cues || cue.score < threshold) break;
    // Never before the first sentence (a slide opens by speaking) or after the final one (the slide
    // change is the pause), and at least one full sentence between cues.
    if (cue.gap < 1 || cue.gap >= sentences.length) continue;
    if (!cues.some((pick) => pick.gap === cue.gap)) cues.push(cue);
  }

  // One treatment per sentence: a sentence read slowly already stands out, so it isn't bolded too.
  const marks: MarkCandidate[] = [];
  for (const type of ["slow", "bold"] as const) {
    for (const mark of markPool.filter((item) => item.mark === type).sort((a, b) => b.score - a.score)) {
      if (marks.filter((pick) => pick.mark === type).length >= limits[type] || mark.score < threshold) break;
      if (!marks.some((pick) => pick.sentence === mark.sentence)) marks.push(mark);
    }
  }

  return {
    cues: cues
      .sort((a, b) => a.gap - b.gap)
      .map((cue) => {
        const previous = sentences[cue.gap - 1];
        return { paragraph: previous.paragraph, afterSentence: previous.index, type: cue.type, text: cue.text };
      }),
    marks: marks
      .sort((a, b) => a.sentence - b.sentence)
      .map((mark) => ({ paragraph: sentences[mark.sentence].paragraph, sentence: sentences[mark.sentence].index, text: mark.text, mark: mark.mark })),
  };
}

/** Rule-based placement: the fallback when the AI delivery pass is unavailable or fails. */
export function placeDelivery(context: DeliveryContext): Delivery {
  if (context.density === "none") return EMPTY;
  const sentences = scriptSentences(context.paragraphs);
  if (!sentences.length) return EMPTY;
  // A small seeded jitter breaks ties differently on each slide, so equal-looking slides don't get identical rhythm.
  const cuePool = cueCandidates(sentences, context).map((cue) => ({ ...cue, score: cue.score + jitter(context.seed, `${cue.gap}:${cue.type}`) }));
  const markPool = markCandidates(sentences).map((mark) => ({ ...mark, score: mark.score + jitter(context.seed, `${mark.sentence}:${mark.mark}`) }));
  return select(sentences, context.density, cuePool, markPool, THRESHOLD[context.density]);
}

/** What a speech coach observed about one sentence. `stress` is the words to hit hardest, empty when nothing qualifies. */
export type SentenceNotes = {
  asksAudience: boolean;
  statesMainPoint: boolean;
  turnsArgument: boolean;
  mustCatchExactly: boolean;
  stress: string;
};

const FIGURE_WORDS = /\d|\b(?:half|double[ds]?|twice|triple[ds]?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|billion|percent)\b/i;
const CONTRAST_WORDS = /\b(?:not|never|no longer|only|none|nothing|instead|but|without|all|every)\b|n't\b/i;

/** Where `phrase` appears in `text` as whole words ("3" is not found inside "Q3"), case-insensitively; -1 if not. */
function wholeWordIndex(text: string, phrase: string) {
  if (!phrase) return -1;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").exec(text)?.index ?? -1;
}

/**
 * Decides cues and marks from the coach's notes with fixed rules, so the same notes always give
 * the same result. Stress words not found verbatim in their sentence are ignored.
 */
export function applySentenceNotes(context: DeliveryContext, notes: SentenceNotes[]): Delivery {
  if (context.density === "none") return EMPTY;
  const sentences = scriptSentences(context.paragraphs);
  if (!sentences.length || notes.length !== sentences.length) return placeDelivery(context);
  const last = sentences.length - 1;

  // The slide's point is one sentence: the first one the coach flagged.
  const main = notes.findIndex((note) => note.statesMainPoint);

  const cues: Candidate[] = [];
  const marks: MarkCandidate[] = [];

  notes.forEach((note, index) => {
    if (note.asksAudience && index < last) cues.push({ gap: index + 1, type: "pause", text: "Pause", score: 4 });
    if (index === main && index < last) cues.push({ gap: index + 1, type: "pause", text: "Pause", score: 3.5 });
    if (note.turnsArgument && index > 0) cues.push({ gap: index, type: "pause", text: "Pause", score: 3 });

    if (note.mustCatchExactly) marks.push({ sentence: index, text: sentences[index].text, mark: "slow", score: 3.5 });

    const phrase = note.stress.trim().replace(/^["“'‘]|["”'’.,]$/g, "");
    const start = wholeWordIndex(sentences[index].text, phrase);
    // Bold is kept for what a listener must not miss: the slide's point, a figure, or a contrast.
    // Other words the coach would stress are left to the presenter's natural delivery.
    const tier = index === main ? 3.6 : FIGURE_WORDS.test(phrase) ? 3.3 : CONTRAST_WORDS.test(phrase) ? 3 : 0;
    if (tier && start >= 0 && phrase.split(/\s+/).length <= 4) {
      marks.push({ sentence: index, text: sentences[index].text.slice(start, start + phrase.length), mark: "bold", score: tier });
    }
  });

  return select(sentences, context.density, cues, marks, THRESHOLD[context.density]);
}
