import type {
  AiStatus,
  GenerationTelemetry,
  AnalyzeOutput,
  AnalyzeRequest,
  ContextOutput,
  ContextRequest,
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
import { serverAuthEnabled } from "./auth";
import { createDemoProvider } from "./demo";
import { createOpenAiProvider } from "./openai";
import { quotasEnabled } from "./quota";

export type ScriptRewriteRequest = Extract<RewriteRequest, { kind: "script" }>;
export type SelectionRewriteRequest = Extract<RewriteRequest, { kind: "selection" }>;
export type SupportRequest = Extract<RewriteRequest, { kind: "support" }>;
export type QuestionsRequest = Extract<RewriteRequest, { kind: "questions" }>;

export interface AiProvider {
  status: AiStatus;
  telemetry?(): GenerationTelemetry;
  analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeOutput>;
  context(request: ContextRequest, signal?: AbortSignal): Promise<ContextOutput>;
  outline(request: OutlineRequest, signal?: AbortSignal): Promise<OutlineOutput>;
  write(request: WriteRequest, signal?: AbortSignal): Promise<WriteOutput>;
  rewriteScript(request: ScriptRewriteRequest, signal?: AbortSignal): Promise<ScriptRewriteOutput>;
  rewriteSelection(request: SelectionRewriteRequest, signal?: AbortSignal): Promise<SelectionRewriteOutput>;
  support(request: SupportRequest, signal?: AbortSignal): Promise<SupportOutput>;
  questions(request: QuestionsRequest, signal?: AbortSignal): Promise<QuestionsOutput>;
}

function env(name: string) {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value?.trim() || undefined;
}

let warnedUnmetered = false;

/**
 * A paid provider in a production build needs sign-in (a Firebase project) and quotas (a service
 * account); without either, anyone could spend the key. AI is then switched off rather than run
 * unmetered. AI_ALLOW_UNMETERED=1 lifts this for a private preview; never set it on a public site.
 */
export function unmeteredInProduction() {
  if (process.env.NODE_ENV !== "production" || env("AI_ALLOW_UNMETERED") === "1") return false;
  if (serverAuthEnabled() && quotasEnabled()) return false;
  if (!warnedUnmetered) {
    warnedUnmetered = true;
    console.error("[ai] AI is off: a production server needs sign-in (Firebase project ID) and quotas (FIREBASE_SERVICE_ACCOUNT) before it uses OPENAI_API_KEY.");
  }
  return true;
}

/**
 * Chooses the AI backend:
 *  - OPENAI_API_KEY set → OpenAI (unless AI_PROVIDER=demo forces the demo), once metered in production.
 *  - AI_PROVIDER=demo, or a development build with no key → the deterministic demo provider.
 *  - otherwise → none; the UI explains that AI isn't configured.
 */
export function getProvider(): AiProvider | null {
  const mode = env("AI_PROVIDER")?.toLowerCase();
  const key = env("OPENAI_API_KEY");
  if (mode === "demo") return createDemoProvider();
  if (key) {
    if (unmeteredInProduction()) return null;
    return createOpenAiProvider({
      apiKey: key,
      model: env("OPENAI_MODEL") ?? "gpt-5.4-mini-2026-03-17",
      baseURL: env("OPENAI_BASE_URL"),
      writerModel: env("OPENAI_WRITER_MODEL"),
    });
  }
  if (process.env.NODE_ENV === "development") return createDemoProvider();
  return null;
}

export function providerStatus(): AiStatus {
  return getProvider()?.status ?? { provider: "none", model: null };
}
