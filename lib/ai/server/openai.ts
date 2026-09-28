import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { z } from "zod";
import {
  AnalyzeOutput,
  type ModelCall,
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
import { PROMPT_VERSION } from "./writing-guide";
import { AiOutputError, exactIds } from "./integrity";
export { AiOutputError } from "./integrity";

type Effort = "low" | "medium" | "high";

const isReasoningModel = (name: string) => /^(gpt-5|o\d)/i.test(name);

/** One model for every stage; `writerModel` optionally gives script writing and rewrites a different one. */
export function createOpenAiProvider({ apiKey, model, baseURL, writerModel = model }: { apiKey: string; model: string; baseURL?: string; writerModel?: string }): AiProvider {
  const client = new OpenAI({ apiKey, baseURL, timeout: 110_000, maxRetries: 0 });

  const calls: ModelCall[] = [];

  async function structured<T extends z.ZodType>(
    schema: T,
    name: string,
    instructions: string,
    content: ResponseInputContent[],
    { effort = "low", verbosity = "medium", signal, use = model, outputLimit = 16000 }: { outputLimit?: number; effort?: Effort; verbosity?: "low" | "medium"; signal?: AbortSignal; use?: string } = {},
  ): Promise<z.infer<T>> {
    const reasoningModel = isReasoningModel(use);
    const started = Date.now();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(instructions));
    const promptHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const record: ModelCall = { stage: name, model: use, promptHash, effort, milliseconds: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0, status: "failed", requestId: "" };
    try {
      const response = await client.responses.parse({
        model: use,
        store: false,
        max_output_tokens: Math.min(48000, Math.max(4000, outputLimit)),
        // Reasoning effort and verbosity exist only on reasoning models (gpt-5, o-series). Sending them to
        // gpt-4.x/4o is a 400, so non-reasoning models (which are also the fastest) just skip them.
        ...(reasoningModel ? { reasoning: { effort } } : {}),
        instructions,
        input: [{ role: "user", content }],
        text: { ...(reasoningModel ? { verbosity } : {}), format: zodTextFormat(schema, name) },
      }, { signal });
      Object.assign(record, { model: response.model, status: response.status ?? "unknown", requestId: response._request_id ?? response.id, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens ?? 0, cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0 });
      if (response.status === "incomplete") throw new AiOutputError(`The response was cut short (${response.incomplete_details?.reason ?? "unknown reason"}).`);
      const parsed = response.output_parsed;
      if (!parsed) throw new AiOutputError("The model returned no structured output.");
      return parsed as z.infer<T>;
    } finally {
      record.milliseconds = Date.now() - started;
      calls.push(record);
    }
  }

  const input = (text: string): ResponseInputContent => ({ type: "input_text", text });

  return {
    status: { provider: "openai", model: writerModel },
    telemetry: () => ({ promptVersion: PROMPT_VERSION, calls: [...calls] }),

    analyze: (request, signal) => structured(AnalyzeOutput, "slide_analysis", ANALYZE_INSTRUCTIONS, request.slides.flatMap((slide): ResponseInputContent[] => [
      input(analyzeText(request, slide)),
      ...(slide.image ? [{ type: "input_image" as const, image_url: slide.image, detail: "auto" as const }] : []),
    ]), { effort: "low", signal }),

    context: (request, signal) => structured(ContextOutput, "deck_context", CONTEXT_INSTRUCTIONS, [input(contextText(request))], { effort: "low", verbosity: "low", signal }),

    outline: (request, signal) => structured(OutlineOutput, "narrative_outline", OUTLINE_INSTRUCTIONS, [input(outlineText(request))], { effort: "low", signal, outputLimit: 4000 + request.slides.length * 240 }),

    write: async (request, signal) => {
      const output = await structured(WriteOutput, "slide_scripts", writeInstructions(request.brief), [input(writeText(request))], { use: writerModel, effort: "low", signal, outputLimit: 4000 + request.slides.reduce((sum, slide) => sum + slide.targetWords * 2, 0) });
      exactIds(request.slides, output.slides);
      return output;
    },

    rewriteScript: (request, signal) => structured(ScriptRewriteOutput, "script_rewrite", rewriteInstructions(request), [input(rewriteText(request))], { use: writerModel, effort: "low", signal }),

    rewriteSelection: (request, signal) => structured(SelectionRewriteOutput, "selection_rewrite", rewriteInstructions(request), [input(rewriteText(request))], { use: writerModel, effort: "low", verbosity: "low", signal }),

    support: (request, signal) => structured(SupportOutput, "slide_support", rewriteInstructions(request), [input(rewriteText(request))], { use: writerModel, effort: "low", verbosity: "low", signal }),

    questions: (request, signal) => structured(QuestionsOutput, "audience_questions", rewriteInstructions(request), [input(rewriteText(request))], { use: writerModel, effort: "low", signal }),
  };
}
