/**
 * Cheap, deterministic checks for script text that reads like slide notes instead of speech.
 * Prompts alone are not consistent enough on smaller models, so the OpenAI provider runs these
 * on each draft and asks the model to redo any slide that fails.
 */

// One to three words then a colon, at the start of a sentence: "Keep:", "Short version:", "Iteration 1 goal:".
const LABEL_OPENER = /(^|[.!?]\s+)[A-Z][A-Za-z0-9’']*(?: [A-Za-z0-9’']+){0,2}:\s+\S/;
// A real spoken sentence with a colon ("Here's the thing: …", "We did it: …") contains one of these.
const SPOKEN_WORDS = /\b(?:the|we|i|it|is|was|are|were|here's|that's|so|and|to)\b/i;
const ID_REFERENCE = /(?:#|PR\s?#?)\d+/gi;

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

/** Returns human-readable problems; an empty array means the text sounds spoken enough. */
export function spokenProblems(paragraphs: string[]): string[] {
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

  return problems;
}

type DraftSlide = { id: string; paragraphs: string[]; concise: string };

/** Slides in a written draft that read like notes: their paragraphs, plus label-style openers in the concise summary. */
export function draftProblems(slides: DraftSlide[]): { id: string; problems: string[] }[] {
  return slides.flatMap((slide) => {
    const problems = [...spokenProblems(slide.paragraphs), ...spokenProblems([slide.concise]).filter((problem) => problem.includes("label"))];
    return problems.length ? [{ id: slide.id, problems }] : [];
  });
}

/**
 * Picks between a draft and its retry so a retry can never make things worse: the retry wins only if
 * it exists, covers every slide the first draft had, and fails on no more slides.
 */
export function pickDraft<T extends { slides: DraftSlide[] }>(first: T, retry: T | null): T {
  if (!retry) return first;
  const ids = new Set(retry.slides.map((slide) => slide.id));
  if (!first.slides.every((slide) => ids.has(slide.id))) return first;
  return draftProblems(retry.slides).length <= draftProblems(first.slides).length ? retry : first;
}
