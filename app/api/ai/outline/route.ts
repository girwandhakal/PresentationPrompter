import { exactIds } from "@/lib/ai/server/integrity";
import { handleAi } from "@/lib/ai/server/http";
import { outlineOutputLimit } from "@/lib/ai/server/openai";
import { writeCallsFor } from "@/lib/ai/server/quota";
import { OutlineRequest } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, OutlineRequest, async (provider, input, signal) => {
    const outline = await provider.outline(input, signal);
    const byId = exactIds(input.slides, outline.slides);
    return {
      arc: trim(outline.arc, 1200),
      voice: trim(outline.voice, 1200),
      slides: input.slides.map((slide) => {
        const planned = byId.get(slide.id)!;
        return {
          id: slide.id,
          role: trim(planned.role, 300),
          keyIdea: trim(planned.keyIdea || slide.mainPoint, 400),
          transition: trim(planned.transition, 400),
        };
      }),
    };
  }, { maxBytes: 1024 * 1024, outputLimit: outlineOutputLimit, grantsWrites: (input) => writeCallsFor(input.slides.length) });
}
