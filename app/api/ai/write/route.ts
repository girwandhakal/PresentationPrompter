import { handleAi } from "@/lib/ai/server/http";
import { AiOutputError, exactIds } from "@/lib/ai/server/integrity";
import { draftNotes, slideSource } from "@/lib/ai/server/spoken-lint";
import { WriteRequest } from "@/lib/ai/schemas";
import { finalizeWrittenSlide } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

/**
 * Writes a batch of slides in one model call. The first and last slides of the talk get their
 * greeting and thanks, and each slide gets private, advisory notes from local checks; no extra
 * model call reviews or repairs the draft.
 */
export function POST(request: Request) {
  return handleAi(request, WriteRequest, async (provider, input, signal) => {
    const output = await provider.write(input, signal);
    const byId = exactIds(input.slides, output.slides);
    const slides = input.slides.map((slide) => ({
      id: slide.id,
      script: finalizeWrittenSlide(byId.get(slide.id)!, slide, input.brief, { first: slide.index === 1, last: slide.index === input.totalSlides }),
    }));
    if (slides.some(({ script }) => !script.paragraphs.some((paragraph) => paragraph.trim()))) throw new AiOutputError("The AI returned an empty script.");
    const evidence = input.slides.map((slide) => slideSource(slide, input.brief)).join("\n");
    return { slides, notes: slides.map(({ id, script }, index) => ({ id, issues: draftNotes({ ...input.slides[index], script }, evidence, input.brief) })) };
  }, { maxBytes: 1024 * 1024 });
}
