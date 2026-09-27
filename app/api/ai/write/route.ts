import { handleAi, mapLimit } from "@/lib/ai/server/http";
import { WriteRequest, type WrittenSlideOutput } from "@/lib/ai/schemas";
import { deliverSlides } from "@/lib/ai/server/delivery";
import { deliveryContext, finalizeWrittenSlide, fitRatio, needsRepair, paragraphsWords, sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/**
 * Writes a batch of slides, validates each against the plan (ids and word budget), then marks
 * delivery (pauses, points, slow, bold) on the final prose. Slides that miss their budget get one targeted repair attempt; the closer of the two
 * versions is kept.
 */
export function POST(request: Request) {
  return handleAi(request, WriteRequest, async (provider, input, signal) => {
    const output = await provider.write(input, signal);
    const byId = new Map(output.slides.map((slide) => [slide.id, slide]));

    const drafts = input.slides.map((slide, position) => {
      const raw = byId.get(slide.id) ?? output.slides[position];
      return raw ? finalizeWrittenSlide(raw, slide, input.brief) : null;
    });

    const repaired = await mapLimit(input.slides, 3, async (slide, index): Promise<WrittenSlideOutput | null> => {
      const draft = drafts[index];
      if (!draft) return null;
      const words = paragraphsWords(draft.paragraphs);
      if (!needsRepair(words, slide.targetWords, input.brief.depth)) return draft;
      try {
        const fixed = await provider.rewriteScript({
          kind: "script",
          action: "fit",
          brief: input.brief,
          title: input.title,
          slide: { title: slide.title, text: slide.text, notes: slide.notes, analysis: slide.analysis, previousTitle: slide.previousTitle, nextTitle: slide.nextTitle },
          paragraphs: draft.paragraphs,
          targetWords: slide.targetWords,
        }, signal);
        const paragraphs = sanitizeParagraphs(fixed.paragraphs);
        const fixedWords = paragraphsWords(paragraphs);
        const better = paragraphs.length && Math.abs(fitRatio(fixedWords, slide.targetWords) - 1) < Math.abs(fitRatio(words, slide.targetWords) - 1);
        if (better) {
          return finalizeWrittenSlide({ ...draft, paragraphs }, slide, input.brief);
        }
      } catch (error) {
        if (signal.aborted) throw error;
        // A failed repair keeps the original draft.
      }
      return draft;
    });

    // Delivery is marked on the final prose, after any repair, in one pass for the whole batch.
    const written = input.slides.flatMap((slide, index) => repaired[index] ? [{ slide, script: repaired[index]! }] : []);
    const delivered = await deliverSlides(provider, written.map(({ slide, script }) => deliveryContext(script.paragraphs, slide, input.brief)), signal);
    const scripts = new Map(written.map(({ slide, script }, index) => [slide.id, { ...script, ...delivered[index] }]));

    return {
      slides: input.slides.map((slide) => ({ id: slide.id, script: scripts.get(slide.id) ?? null })),
    };
  }, { maxBytes: 1024 * 1024 });
}
