import { handleAi } from "@/lib/ai/server/http";
import { AiOutputError } from "@/lib/ai/server/integrity";
import { RewriteRequest } from "@/lib/ai/schemas";
import { frameTalk, sanitizeParagraphs } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, RewriteRequest, async (provider, input, signal) => {
    switch (input.kind) {
      case "script": {
        const result = await provider.rewriteScript(input, signal);
        const sanitized = sanitizeParagraphs(result.paragraphs);
        if (!sanitized.length) throw new AiOutputError("The AI returned an empty rewrite.");
        const paragraphs = frameTalk(sanitized, { first: !input.slide.previousTitle, last: !input.slide.nextTitle }, input.brief.depth);
        return { kind: "script", paragraphs };
      }
      case "selection": {
        const result = await provider.rewriteSelection(input, signal);
        const text = result.text.replace(/^["“]|["”]$/g, "").trim();
        if (!text) throw new AiOutputError("The AI returned an empty rewrite.");
        return { kind: "selection", text };
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
