/**
 * Pairs slides of a replacement deck with the slides of the current one so scripts can carry over.
 * Content similarity first (title and text), then position for same-length decks. Every pairing is
 * shown to the presenter before it is applied.
 */

type Matchable = { id: string; title: string; text: string };
export type SlideMatch = { newId: string; oldId: string | null; reason: "content" | "position" | null; score: number };

function tokens(slide: Matchable) {
  return new Set(`${slide.title} ${slide.text}`.toLowerCase().match(/[a-z0-9][a-z0-9'%-]{2,}/g) ?? []);
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function similarity(a: Matchable, b: Matchable) {
  const left = tokens(a);
  const right = tokens(b);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  const jaccard = union ? shared / union : 0;
  const sameTitle = normalizeTitle(a.title) && normalizeTitle(a.title) === normalizeTitle(b.title) ? 0.5 : 0;
  return Math.min(1, jaccard + sameTitle);
}

export const MATCH_THRESHOLD = 0.3;

export function matchSlides(oldSlides: Matchable[], newSlides: Matchable[]): SlideMatch[] {
  const pairs: { newIndex: number; oldIndex: number; score: number }[] = [];
  newSlides.forEach((fresh, newIndex) => {
    oldSlides.forEach((old, oldIndex) => {
      const score = similarity(fresh, old);
      if (score >= MATCH_THRESHOLD) pairs.push({ newIndex, oldIndex, score });
    });
  });
  // Prefer stronger matches; break ties by keeping slides near their original position.
  pairs.sort((a, b) => b.score - a.score || Math.abs(a.newIndex - a.oldIndex) - Math.abs(b.newIndex - b.oldIndex));

  const result: SlideMatch[] = newSlides.map((slide) => ({ newId: slide.id, oldId: null, reason: null, score: 0 }));
  const usedOld = new Set<number>();
  for (const pair of pairs) {
    if (result[pair.newIndex].oldId || usedOld.has(pair.oldIndex)) continue;
    result[pair.newIndex] = { newId: newSlides[pair.newIndex].id, oldId: oldSlides[pair.oldIndex].id, reason: "content", score: pair.score };
    usedOld.add(pair.oldIndex);
  }

  if (oldSlides.length === newSlides.length) {
    result.forEach((match, index) => {
      if (!match.oldId && !usedOld.has(index)) {
        result[index] = { newId: match.newId, oldId: oldSlides[index].id, reason: "position", score: 0 };
        usedOld.add(index);
      }
    });
  }
  return result;
}
