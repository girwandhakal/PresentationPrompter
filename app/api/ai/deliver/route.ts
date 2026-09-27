import { deliverSlides } from "@/lib/ai/server/delivery";
import { handleAi, mapLimit } from "@/lib/ai/server/http";
import { DeliverRequest, type DeliveredSlide } from "@/lib/ai/schemas";
import { sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/** Slides the coach reads together: enough to see the talk's rhythm, small enough to answer quickly. */
const CHUNK = 8;

/**
 * Marks delivery (pauses, bold, slow) for a whole written deck in one pass, after every slide's
 * prose is final. Running per deck rather than per write batch lets the coach read neighbouring
 * slides together and keeps the number of model calls small.
 */
export function POST(request: Request) {
  return handleAi(request, DeliverRequest, async (provider, input, signal) => {
    const contexts = input.slides.map((slide) => ({
      paragraphs: sanitizeParagraphs(slide.paragraphs),
      density: input.density,
      seed: slide.id,
      title: slide.title,
      keyIdea: slide.keyIdea,
      kind: slide.kind,
      first: slide.first,
    }));
    const chunks = Array.from({ length: Math.ceil(contexts.length / CHUNK) }, (_, index) => contexts.slice(index * CHUNK, (index + 1) * CHUNK));
    const delivered = (await mapLimit(chunks, 2, (group) => deliverSlides(provider, group, signal))).flat();
    const slides: DeliveredSlide[] = input.slides.map((slide, index) => ({ id: slide.id, ...delivered[index] }));
    return { slides };
  }, { maxBytes: 1024 * 1024 });
}
