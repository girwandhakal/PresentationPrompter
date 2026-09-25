import { handleAi } from "@/lib/ai/server/http";
import { AnalyzeRequest } from "@/lib/ai/schemas";
import { clampComplexity } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, AnalyzeRequest, async (provider, input, signal) => {
    const output = await provider.analyze(input, signal);
    const byId = new Map(output.slides.map((slide) => [slide.id, slide]));
    return {
      slides: input.slides.map((slide, position) => {
        // Models occasionally echo ids imperfectly; fall back to position before giving up.
        const result = byId.get(slide.id) ?? output.slides[position];
        if (!result) return { id: slide.id, analysis: null };
        return {
          id: slide.id,
          analysis: {
            title: trim(result.title, 160),
            mainPoint: trim(result.mainPoint, 400),
            visualSummary: trim(result.visualSummary, 800),
            elements: result.elements.slice(0, 6).map((element) => ({ label: trim(element.label, 120), region: trim(element.region, 60) })),
            complexity: clampComplexity(result.complexity),
            kind: result.kind,
            uncertain: result.uncertain.map((item) => trim(item, 240)).filter(Boolean).slice(0, 4),
          },
        };
      }),
    };
  }, { maxBytes: 12 * 1024 * 1024 });
}
