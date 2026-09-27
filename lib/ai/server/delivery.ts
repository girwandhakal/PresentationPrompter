import { applySentenceNotes, placeDelivery, scriptSentences, type Delivery, type DeliveryContext, type SentenceNotes } from "../../domain/cues";
import type { DeliveryOutput, DeliveryRequest } from "../schemas";
import { exactIds } from "./integrity";
import type { AiProvider } from "./provider";

const READ_TIMEOUT_MS = 30_000;

type SlideRead = DeliveryOutput["slides"][number];

/** One read of a slide as per-sentence notes, or null when its numbering doesn't match the script. */
export function readSentenceNotes(read: SlideRead | undefined, sentenceCount: number): SentenceNotes[] | null {
  if (!read || read.sentences.length !== sentenceCount) return null;
  const byNumber = new Map(read.sentences.map(({ n, ...notes }) => [n, notes]));
  const notes = Array.from({ length: sentenceCount }, (_, index) => byNumber.get(index + 1));
  return notes.every(Boolean) ? notes as SentenceNotes[] : null;
}

/**
 * Cues and marks for finished slides. The provider's speech coach answers factual questions about
 * every sentence in one read, and fixed rules turn the answers into guidance. Slides the read
 * didn't cover, and every slide when the coach is unavailable or fails, fall back to rule-based
 * placement, so a script always gets its guidance.
 */
export async function deliverSlides(provider: AiProvider, contexts: DeliveryContext[], signal: AbortSignal): Promise<(Delivery & { deliveryMode: "ai" | "fallback" | "none" })[]> {
  const rules = (context: DeliveryContext) => ({ ...placeDelivery(context), deliveryMode: context.density === "none" ? "none" as const : "fallback" as const });
  const wanted = contexts.filter((context) => context.density !== "none" && context.paragraphs.length);
  if (!provider.delivery || !wanted.length) return contexts.map(rules);

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

  let reads: Map<string, SlideRead>;
  try {
    // A stalled read shouldn't hold the script; rule-based cues are a fine fallback.
    const result = await provider.delivery(request, AbortSignal.any([signal, AbortSignal.timeout(READ_TIMEOUT_MS)]));
    reads = exactIds(request.slides, result.slides);
  } catch (error) {
    if (signal.aborted) throw error;
    const reason = error as { status?: number; name?: string };
    console.error("[ai] delivery pass failed; using rule-based cues", { status: reason?.status, error: reason?.name });
    return contexts.map(rules);
  }

  return contexts.map((context) => {
    const notes = readSentenceNotes(reads.get(context.seed), scriptSentences(context.paragraphs).length);
    return notes ? { ...applySentenceNotes(context, notes), deliveryMode: "ai" as const } : rules(context);
  });
}
