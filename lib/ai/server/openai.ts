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

type Effort = "low" | "medium" | "high";

export class AiOutputError extends Error {}

export function createOpenAiProvider({ apiKey, model, baseURL }: { apiKey: string; model: string; baseURL?: string }): AiProvider {
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
      reasoning: { effort },
      instructions,
      input: [{ role: "user", content }],
      text: { verbosity, format: zodTextFormat(schema, name) },
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

    outline: (request, signal) => structured(OutlineOutput, "narrative_outline", OUTLINE_INSTRUCTIONS, [input(outlineText(request))], { effort: "medium", signal }),

    write: (request, signal) => structured(WriteOutput, "slide_scripts", writeInstructions(request.brief), [input(writeText(request))], { effort: "medium", signal }),

    rewriteScript: (request, signal) => structured(ScriptRewriteOutput, "script_rewrite", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", signal }),

    rewriteSelection: (request, signal) => structured(SelectionRewriteOutput, "selection_rewrite", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", verbosity: "low", signal }),

    support: (request, signal) => structured(SupportOutput, "slide_support", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", verbosity: "low", signal }),

    questions: (request, signal) => structured(QuestionsOutput, "audience_questions", rewriteInstructions(request), [input(rewriteText(request))], { effort: "low", signal }),
  };
}
