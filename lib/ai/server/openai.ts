import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { z } from "zod";
import {
  AnalyzeOutput,
  ContextOutput,
  OutlineOutput,
  QuestionsOutput,
  ScriptRewriteOutput,
  SelectionRewriteOutput,
  SupportOutput,
  WriteOutput,
} from "../schemas";
import type { AiProvider } from "./provider";
import {
  ANALYZE_INSTRUCTIONS,
  analyzeText,
  CONTEXT_INSTRUCTIONS,
  contextText,
  OUTLINE_INSTRUCTIONS,
  outlineText,
  rewriteInstructions,
  rewriteText,
  writeInstructions,
  writeText,
} from "./prompts";
import { spokenProblems } from "./spoken-lint";

type Effort = "low" | "medium" | "high";

export class AiOutputError extends Error {}

export function createOpenAiProvider({ apiKey, model, baseURL }: { apiKey: string; model: string; baseURL?: string }): AiProvider {
  const reasoningModel = /^(gpt-5|o\d)/i.test(model);
  const client = new OpenAI({ apiKey, baseURL, timeout: 110_000, maxRetries: 2 });

  async function structured<T extends z.ZodType>(
    schema: T,
    name: string,
    instructions: string,
    content: ResponseInputContent[],
    { effort = "low", verbosity = "medium", signal }: { effort?: Effort; verbosity?: "low" | "medium"; signal?: AbortSignal } = {},
  ): Promise<z.infer<T>> {
    const response = await client.responses.parse({
      model,
      store: false,
      // Reasoning effort and verbosity exist only on reasoning models (gpt-5, o-series). Sending them to
      // gpt-4.x/4o is a 400, so non-reasoning models (which are also the fastest) just skip them.
      ...(reasoningModel ? { reasoning: { effort } } : {}),
      instructions,
      input: [{ role: "user", content }],
      text: { ...(reasoningModel ? { verbosity } : {}), format: zodTextFormat(schema, name) },
    }, { signal });
    if (response.status === "incomplete") throw new AiOutputError(`The response was cut short (${response.incomplete_details?.reason ?? "unknown reason"}).`);
    const parsed = response.output_parsed;
    if (!parsed) throw new AiOutputError("The model returned no structured output.");
    return parsed as z.infer<T>;
  }

  const input = (text: string): ResponseInputContent => ({ type: "input_text", text });

  return {
    status: { provider: "openai", model },

    analyze: (request, signal) => structured(AnalyzeOutput, "slide_analysis", ANALYZE_INSTRUCTIONS, request.slides.flatMap((slide): ResponseInputContent[] => [
      input(analyzeText(request, slide)),
      ...(slide.image ? [{ type: "input_image" as const, image_url: slide.image, detail: "auto" as const }] : []),
    ]), { effort: "low", signal }),

    context: (request, signal) => structured(ContextOutput, "deck_context", CONTEXT_INSTRUCTIONS, [input(contextText(request))], { effort: "low", verbosity: "low", signal }),

    outline: (request, signal) => structured(OutlineOutput, "narrative_outline", OUTLINE_INSTRUCTIONS, [input(outlineText(request))], { effort: "low", signal }),

    write: async (request, signal) => {
      const instructions = writeInstructions(request.brief);
      const text = writeText(request);
      const first = await structured(WriteOutput, "slide_scripts", instructions, [input(text)], { effort: "low", signal });
      const failing = first.slides.flatMap((slide) => {
        const problems = [...spokenProblems(slide.paragraphs), ...spokenProblems([slide.concise]).filter((problem) => problem.includes("label"))];
        return problems.length ? [{ id: slide.id, problems }] : [];
      });
      if (!failing.length) return first;
      const feedback = failing.map((item) => `- Slide id ${item.id}: ${item.problems.join(" ")}`).join("\n");
      const second = await structured(WriteOutput, "slide_scripts", instructions, [
        input(`${text}\n\nA previous draft was rejected because parts of it read like slide notes, not speech:\n${feedback}\n\nRewrite the whole set. Fix these slides and keep the rest of the same quality, word targets, and structure.`),
      ], { effort: "low", signal });
      // Keep whichever draft has fewer failing slides, so a retry can never make things worse.
      const secondFailing = second.slides.filter((slide) => spokenProblems(slide.paragraphs).length).length;
      return secondFailing <= failing.length ? second : first;
    },

    rewriteScript: async (request, signal) => {
      const instructions = rewriteInstructions(request);
      const text = rewriteText(request);
      const first = await structured(ScriptRewriteOutput, "script_rewrite", instructions, [input(text)], { effort: "low", signal });
      const problems = spokenProblems(first.paragraphs);
      if (!problems.length) return first;
      const second = await structured(ScriptRewriteOutput, "script_rewrite", instructions, [
        input(`${text}\n\nA previous draft was rejected because it read like slide notes, not speech:\n${problems.map((problem) => `- ${problem}`).join("\n")}\n\nWrite it again as natural spoken sentences.`),
      ], { effort: "low", signal });
      return spokenProblems(second.paragraphs).length <= problems.length ? second : first;
    },

    rewriteSelection: (request, signal) => structured(SelectionRewriteOutput, "selection_rewrite", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", verbosity: "low", signal }),

    support: (request, signal) => structured(SupportOutput, "slide_support", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", verbosity: "low", signal }),

    questions: (request, signal) => structured(QuestionsOutput, "audience_questions", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", signal }),
  };
}
