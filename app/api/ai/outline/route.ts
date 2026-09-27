import { handleAi } from "@/lib/ai/server/http";
import { OutlineRequest } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, OutlineRequest, async (provider, input, signal) => {
    const outline = await provider.outline(input, signal);
    const byId = new Map(outline.slides.map((slide) => [slide.id, slide]));
    return {
      arc: trim(outline.arc, 1200),
      voice: trim(outline.voice, 1200),
      slides: input.slides.map((slide, position) => {
        const planned = byId.get(slide.id) ?? outline.slides[position];
        return {
          id: slide.id,
          role: trim(planned?.role ?? "", 300),
          keyIdea: trim(planned?.keyIdea ?? slide.mainPoint, 400),
          transition: trim(planned?.transition ?? "", 400),
        };
      }),
    };
  }, { maxBytes: 1024 * 1024 });
}
