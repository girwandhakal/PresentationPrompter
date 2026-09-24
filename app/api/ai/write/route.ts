import { handleAi, mapLimit } from "@/lib/ai/server/http";
import { WriteRequest, type WrittenSlideOutput } from "@/lib/ai/schemas";
import { finalizeWrittenSlide, fitRatio, needsRepair, paragraphsWords, sanitizeCues, sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/**
 * Writes a batch of slides, then validates each against the plan: ids, cue anchors, grounding of
 * figures, and word budget. Slides that miss their budget get one targeted repair attempt; the
 * closer of the two versions is kept, and a remaining miss is reported to the presenter.
 */
export function POST(request: Request) {
  return handleAi(request, WriteRequest, async (provider, input, signal) => {
    const output = await provider.write(input, signal);
    const byId = new Map(output.slides.map((slide) => [slide.id, slide]));

    const drafts = input.slides.map((slide, position) => {
      const raw = byId.get(slide.id) ?? output.slides[position];
      return raw ? finalizeWrittenSlide(raw, slide, input.brief) : null;
    });

    const repaired = await mapLimit(input.slides, 3, async (slide, index): Promise<WrittenSlideOutput & { words: number; target: number } | null> => {
      const draft = drafts[index];
      if (!draft) return null;
      const words = paragraphsWords(draft.paragraphs);
      if (!needsRepair(words, slide.targetWords, input.brief.depth)) return { ...draft, words, target: slide.targetWords };
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
          const next = finalizeWrittenSlide({ ...draft, paragraphs, cues: sanitizeCues(fixed.cues, paragraphs, input.brief.cueDensity) }, slide, input.brief);
          return { ...next, words: fixedWords, target: slide.targetWords };
        }
      } catch (error) {
        if (signal.aborted) throw error;
        // A failed repair keeps the original draft; the budget note below tells the presenter.
      }
      return { ...draft, words, target: slide.targetWords };
    });

    return {
      slides: input.slides.map((slide, index) => {
        const result = repaired[index];
        if (!result) return { id: slide.id, script: null };
        const { words, target, ...script } = result;
        const ratio = fitRatio(words, target);
        const budgetFlag = target >= 15 && needsRepair(words, target, input.brief.depth)
          ? [{ kind: ratio > 1 ? "over-budget" as const : "under-budget" as const, message: `About ${words} words against a plan of ${target}. ${ratio > 1 ? "Consider shortening." : "There's room to expand."}` }]
          : [];
        return { id: slide.id, script: { ...script, flags: [...script.flags, ...budgetFlag] } };
      }),
    };
  }, { maxBytes: 1024 * 1024 });
}
