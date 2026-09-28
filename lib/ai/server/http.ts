import OpenAI from "openai";
import type { z } from "zod";
import { authenticate, serverAuthEnabled } from "./auth";
import { AiOutputError } from "./integrity";
import { QuotaError, quotaExempt, quotasEnabled, reserve, settle, usedTokens, type Reservation } from "./quota";
import { getProvider, type AiProvider } from "./provider";

const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 90;
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Best-effort burst limit per signed-in user (or per IP when sign-in is off). It is in-memory, so
 * each server instance counts separately; durable quotas need shared server state.
 */
function rateLimited(request: Request, uid?: string) {
  const client = uid ? `user:${uid}` : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const bucket = buckets.get(client);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(client, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) for (const [key, value] of buckets) if (value.resetAt < now) buckets.delete(key);
    return false;
  }
  bucket.count += 1;
  return bucket.count > LIMIT_PER_WINDOW;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function failure(status: number, code: string, error: string, headers?: Record<string, string>) {
  return json({ code, error }, status, headers);
}

async function readJson(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { tooLarge: true as const };
  const text = await request.text();
  if (text.length > maxBytes) return { tooLarge: true as const };
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { invalid: true as const };
  }
}

/**
 * Shared shape for every AI route: provider check, sign-in check, rate limit, size limit, schema validation,
 * cancellation, and mapping of provider errors to calm, user-safe messages. Request and response
 * content is never logged.
 */
export async function handleAi<S extends z.ZodType>(
  request: Request,
  schema: S,
  run: (provider: AiProvider, input: z.infer<S>, signal: AbortSignal) => Promise<unknown>,
  { maxBytes = 512 * 1024 }: { maxBytes?: number } = {},
) {
  const provider = getProvider();
  if (!provider) return failure(503, "ai_unavailable", "AI isn't set up on this server yet. Add OPENAI_API_KEY to enable script writing.");
  let uid: string | undefined;
  let email: string | null = null;
  if (serverAuthEnabled) {
    const caller = await authenticate(request);
    if ("error" in caller) return failure(caller.status, caller.code, caller.error);
    ({ uid, email } = caller);
  }
  if (rateLimited(request, uid)) return failure(429, "rate_limited", "Too many AI requests at once. Wait a moment and try again.", { "retry-after": "20" });

  const body = await readJson(request, maxBytes);
  if ("tooLarge" in body) return failure(413, "too_large", "This request is too large to send to the AI.");
  if ("invalid" in body) return failure(400, "invalid_json", "The request couldn't be read.");
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return failure(400, "invalid_request", "The request was incomplete or invalid.");

  let reservation: Reservation | null = null;
  if (uid && quotasEnabled()) {
    try {
      reservation = await reserve(uid, new URL(request.url).pathname.split("/").pop() ?? "", quotaExempt(email));
    } catch (error) {
      if (error instanceof QuotaError) return failure(429, "quota", error.message, { "x-quota-reset": error.resetAt });
      console.error("[ai] quota check failed", error instanceof Error ? error.name : typeof error);
      return failure(503, "quota_unavailable", "AI usage couldn't be checked right now. Try again in a moment.");
    }
  }

  let outcome: { tokens: number | null } = { tokens: null };
  try {
    const result = await run(provider, parsed.data, request.signal);
    const telemetry = provider.telemetry?.();
    outcome = { tokens: usedTokens(telemetry) };
    return json({ ...(result as object), telemetry });
  } catch (error) {
    // A failed call may still have been billed; count what the provider reported, else the reservation.
    const reported = usedTokens(provider.telemetry?.());
    if (reported) outcome = { tokens: reported };
    return mapError(error);
  } finally {
    if (reservation) await settle(reservation, outcome.tokens).catch(() => console.error("[ai] usage settle failed"));
  }
}

function mapError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return failure(499, "cancelled", "The request was cancelled.");
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    console.error("[ai] timeout");
    return failure(504, "timeout", "The AI took too long to respond. Try again.");
  }
  if (error instanceof OpenAI.APIConnectionError) {
    console.error("[ai] connection error");
    return failure(502, "unreachable", "The AI service couldn't be reached. Check the connection and try again.");
  }
  if (error instanceof OpenAI.APIError) {
    console.error("[ai] provider error", { status: error.status, code: error.code, requestId: error.requestID });
    if (error.status === 401 || error.status === 403) return failure(502, "auth", "The AI service rejected the API key. Check OPENAI_API_KEY on the server.");
    if (error.status === 404) return failure(502, "model", "The configured AI model isn't available. Check OPENAI_MODEL on the server.");
    if (error.status === 429) return failure(429, "busy", "The AI service is busy right now. Try again in a minute.", { "retry-after": "30" });
    if (error.status === 400) return failure(422, "rejected", "The AI couldn't process this content. Try a smaller section or different wording.");
    return failure(502, "provider", "The AI service had a problem. Try again.");
  }
  if (error instanceof AiOutputError) {
    console.error("[ai] unusable output");
    return failure(502, "bad_output", "The AI returned an incomplete answer. Try again.");
  }
  console.error("[ai] unexpected failure", error instanceof Error ? error.name : typeof error);
  return failure(500, "internal", "Something went wrong while talking to the AI. Try again.");
}

/** Runs async work over items with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  }));
  return results;
}
