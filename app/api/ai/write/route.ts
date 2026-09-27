import { handleAi, mapLimit } from "@/lib/ai/server/http";
import { WriteRequest, type WrittenSlideOutput } from "@/lib/ai/schemas";
import { finalizeWrittenSlide, fitRatio, needsRepair, paragraphsWords, sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/**
 * Writes a batch of slides and validates each against the plan (ids and word budget). Slides that
 * miss their budget get one targeted repair attempt; the closer of the two versions is kept, and a
 * kept repair gets fresh support notes so they describe the words actually spoken.
 *
 * Cues and marks returned here come from rules; the browser replaces them with the delivery pass
 * (/api/ai/deliver) once the whole deck is written.
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
      const context = { title: slide.title, text: slide.text, notes: slide.notes, analysis: slide.analysis, previousTitle: slide.previousTitle, nextTitle: slide.nextTitle };
      try {
        const fixed = await provider.rewriteScript({ kind: "script", action: "fit", brief: input.brief, title: input.title, slide: context, paragraphs: draft.paragraphs, targetWords: slide.targetWords }, signal);
        const paragraphs = sanitizeParagraphs(fixed.paragraphs);
        const better = paragraphs.length && Math.abs(fitRatio(paragraphsWords(paragraphs), slide.targetWords) - 1) < Math.abs(fitRatio(words, slide.targetWords) - 1);
        if (!better) return draft;
        // The first draft's summary, keywords, and transition described text that was just replaced.
        const support = await provider.support({ kind: "support", brief: input.brief, title: input.title, slide: context, paragraphs }, signal).catch((error) => {
          if (signal.aborted) throw error;
          return null;
        });
        return finalizeWrittenSlide({ ...draft, paragraphs, ...(support ?? {}) }, slide, input.brief);
      } catch (error) {
        if (signal.aborted) throw error;
        // A failed repair keeps the original draft.
        return draft;
      }
    });

    return {
      slides: input.slides.map((slide, index) => ({ id: slide.id, script: repaired[index] })),
    };
  }, { maxBytes: 1024 * 1024 });
}
