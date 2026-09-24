import { handleAi } from "@/lib/ai/server/http";
import { RewriteRequest } from "@/lib/ai/schemas";
import { sanitizeCues, sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, RewriteRequest, async (provider, input, signal) => {
    switch (input.kind) {
      case "script": {
        const result = await provider.rewriteScript(input, signal);
        const paragraphs = sanitizeParagraphs(result.paragraphs);
        return { kind: "script", paragraphs, cues: sanitizeCues(result.cues, paragraphs, input.brief.cueDensity) };
      }
      case "selection": {
        const result = await provider.rewriteSelection(input, signal);
        return { kind: "selection", text: result.text.replace(/^["“]|["”]$/g, "").trim() };
      }
      case "support": {
        const result = await provider.support(input, signal);
        return {
          kind: "support",
          concise: trim(result.concise, 500),
          keywords: result.keywords.map((keyword) => trim(keyword, 60)).filter(Boolean).slice(0, 6),
          recovery: trim(result.recovery, 300),
          transition: trim(result.transition, 300),
        };
      }
      case "questions": {
        const result = await provider.questions(input, signal);
        return {
          kind: "questions",
          questions: result.questions.filter((question) => question.question.trim()).slice(0, 4).map((question) => ({ question: trim(question.question, 300), answer: trim(question.answer, 600) })),
        };
      }
    }
  });
}
