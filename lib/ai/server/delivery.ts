import { applySentenceNotes, placeDelivery, scriptSentences, type Delivery, type DeliveryContext, type SentenceNotes } from "../../domain/cues";
import type { DeliveryOutput, DeliveryRequest } from "../schemas";
import type { AiProvider } from "./provider";

/**
 * Independent reads of the same script. Even at temperature 0 a single read varies from run to
 * run; a fact most reads agree on is stable, so the majority decides. Reads run in parallel.
 */
export const DELIVERY_READS = 3;
const READ_TIMEOUT_MS = 30_000;

type SlideRead = DeliveryOutput["slides"][number];

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}%$€£/ ]/gu, "").replace(/\s+/g, " ").trim();

/** The value more than `share` of reads gave (every read, when share is 1), or "" when they don't agree. */
function agreed(values: string[], reads: number, share: number) {
  const counts = new Map<string, { count: number; original: string }>();
  for (const value of values) {
    const key = normalize(value);
    if (!key) continue;
    const entry = counts.get(key) ?? { count: 0, original: value.trim() };
    entry.count += 1;
    counts.set(key, entry);
  }
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  const enough = share >= 1 ? best?.count === reads : (best?.count ?? 0) > reads * share;
  return best && enough ? best.original : "";
}

/** Combines reads of one slide into per-sentence notes; reads with the wrong sentence count are ignored. */
export function voteSentenceNotes(reads: SlideRead[], sentenceCount: number): SentenceNotes[] | null {
  const usable = reads.filter((read) => read.sentences.length === sentenceCount);
  if (!usable.length) return null;
  const share = (count: number) => count / usable.length;
  return Array.from({ length: sentenceCount }, (_, index) => {
    const answers = usable.map((read) => read.sentences.find((sentence) => sentence.n === index + 1) ?? read.sentences[index]);
    const agree = (field: "asksAudience" | "statesMainPoint" | "turnsArgument" | "mustCatchExactly") => share(answers.filter((answer) => answer[field]).length);
    return {
      asksAudience: agree("asksAudience"),
      statesMainPoint: agree("statesMainPoint"),
      turnsArgument: agree("turnsArgument"),
      mustCatchExactly: agree("mustCatchExactly"),
      // Stress is the most subjective answer; it only counts when every read picked the same words.
      stress: agreed(answers.map((answer) => answer.stress), usable.length, 1),
    };
  });
}

/**
 * Cues and marks for finished slides. The provider's speech coach answers factual questions about
 * every sentence; the majority of its reads becomes notes, and fixed rules turn notes into
 * guidance. Slides no read covered, and every slide when the coach is unavailable or all reads
 * fail, fall back to rule-based placement, so a script always gets its guidance.
 */
export async function deliverSlides(provider: AiProvider, contexts: DeliveryContext[], signal: AbortSignal, readCount = DELIVERY_READS): Promise<Delivery[]> {
  const fallback = () => contexts.map(placeDelivery);
  const wanted = contexts.filter((context) => context.density !== "none" && context.paragraphs.length);
  if (!provider.delivery || !wanted.length) return fallback();

  const request: DeliveryRequest = {
    slides: wanted.map((context) => {
      const sentences = scriptSentences(context.paragraphs);
      return {
        id: context.seed,
        title: context.title ?? "",
        kind: context.kind ?? "",
        keyIdea: context.keyIdea ?? "",
        sentences: sentences.map((sentence) => sentence.text),
        paragraphStarts: sentences.flatMap((sentence, index) => sentence.opensParagraph ? [index + 1] : []),
      };
    }),
  };

  const delivery = provider.delivery.bind(provider);
  // One stalled read shouldn't hold the script: reads that miss the deadline are left out of the vote.
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(READ_TIMEOUT_MS)]);
  const settled = await Promise.allSettled(Array.from({ length: readCount }, () => delivery(request, deadline)));
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const reads = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!reads.length) {
    // Usually a delivery model this key can't use (see OPENAI_DELIVERY_MODEL); scripts still get rule-based cues.
    const reason = settled.find((result) => result.status === "rejected")?.reason as { status?: number; name?: string } | undefined;
    console.error("[ai] delivery pass failed; using rule-based cues", { status: reason?.status, error: reason?.name });
    return fallback();
  }

  return contexts.map((context) => {
    const slideReads = reads.flatMap((read) => read.slides.filter((slide) => slide.id === context.seed));
    const notes = voteSentenceNotes(slideReads, scriptSentences(context.paragraphs).length);
    return notes ? applySentenceNotes(context, notes) : placeDelivery(context);
  });
}
