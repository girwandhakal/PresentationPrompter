import type {
  AiStatus,
  AnalyzeOutput,
  AnalyzeRequest,
  ContextOutput,
  ContextRequest,
  DeliveryOutput,
  DeliveryRequest,
  OutlineOutput,
  OutlineRequest,
  QuestionsOutput,
  RewriteRequest,
  ScriptRewriteOutput,
  SelectionRewriteOutput,
  SupportOutput,
  WriteOutput,
  WriteRequest,
} from "../schemas";
import { createDemoProvider } from "./demo";
import { createOpenAiProvider } from "./openai";

export type ScriptRewriteRequest = Extract<RewriteRequest, { kind: "script" }>;
export type SelectionRewriteRequest = Extract<RewriteRequest, { kind: "selection" }>;
export type SupportRequest = Extract<RewriteRequest, { kind: "support" }>;
export type QuestionsRequest = Extract<RewriteRequest, { kind: "questions" }>;

export interface AiProvider {
  status: AiStatus;
  analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeOutput>;
  context(request: ContextRequest, signal?: AbortSignal): Promise<ContextOutput>;
  outline(request: OutlineRequest, signal?: AbortSignal): Promise<OutlineOutput>;
  write(request: WriteRequest, signal?: AbortSignal): Promise<WriteOutput>;
  rewriteScript(request: ScriptRewriteRequest, signal?: AbortSignal): Promise<ScriptRewriteOutput>;
  rewriteSelection(request: SelectionRewriteRequest, signal?: AbortSignal): Promise<SelectionRewriteOutput>;
  support(request: SupportRequest, signal?: AbortSignal): Promise<SupportOutput>;
  questions(request: QuestionsRequest, signal?: AbortSignal): Promise<QuestionsOutput>;
  /** Marks pauses, points, slow and bold in finished scripts. Optional: without it, rules place them. */
  delivery?(request: DeliveryRequest, signal?: AbortSignal): Promise<DeliveryOutput>;
}

function env(name: string) {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value?.trim() || undefined;
}

/**
 * Chooses the AI backend:
 *  - OPENAI_API_KEY set → OpenAI (unless AI_PROVIDER=demo forces the demo).
 *  - AI_PROVIDER=demo, or a development build with no key → the deterministic demo provider.
 *  - otherwise → none; the UI explains that AI isn't configured.
 */
export function getProvider(): AiProvider | null {
  const mode = env("AI_PROVIDER")?.toLowerCase();
  const key = env("OPENAI_API_KEY");
  if (mode === "demo") return createDemoProvider();
  if (key) {
    return createOpenAiProvider({
      apiKey: key,
      model: env("OPENAI_MODEL") ?? "gpt-5.4-mini",
      deliveryModel: env("OPENAI_DELIVERY_MODEL") ?? "gpt-5.4",
      baseURL: env("OPENAI_BASE_URL"),
    });
  }
  if (process.env.NODE_ENV === "development") return createDemoProvider();
  return null;
}

export function providerStatus(): AiStatus {
  return getProvider()?.status ?? { provider: "none", model: null };
}
