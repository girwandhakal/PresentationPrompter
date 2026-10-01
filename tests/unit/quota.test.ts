import assert from "node:assert/strict";
import { test } from "node:test";
import { admit, DEFAULT_LIMITS, quotaExempt, usedTokens, utcDay, worstCaseTokens, writeCallsFor } from "../../lib/ai/server/quota";
import { maxOutputTokens, writeOutputLimit } from "../../lib/ai/server/openai";
import { fitScriptParagraphs, SCRIPT_LIMITS, WRITE_BATCH } from "../../lib/ai/limits";
import { RewriteRequest, type WriteRequest } from "../../lib/ai/schemas";

const fresh = { tokens: 0, reserved: 0, generations: 0, running: 0, writeCredits: 0 };
const idle = { tokens: 0, reserved: 0 };
const ESTIMATE = 40_000;

test("admits a call within every allowance", () => {
  assert.equal(admit("analyze", ESTIMATE, DEFAULT_LIMITS, fresh, idle).ok, true);
});

test("counts in-flight reservations against the user's daily tokens", () => {
  const nearlyFull = { ...fresh, tokens: 350_000, reserved: 40_000 };
  assert.equal(admit("rewrite", ESTIMATE, DEFAULT_LIMITS, nearlyFull, idle).ok, false);
});

test("the shared app-wide allowance is first come", () => {
  const decision = admit("analyze", ESTIMATE, DEFAULT_LIMITS, fresh, { tokens: 1_990_000, reserved: 0 });
  assert.equal(decision.ok, false);
  assert.match(!decision.ok ? decision.message : "", /shared/);
});

test("only new generations (outline) are capped per day", () => {
  const used = { ...fresh, generations: DEFAULT_LIMITS.userDailyGenerations };
  assert.equal(admit("outline", ESTIMATE, DEFAULT_LIMITS, used, idle).ok, false);
  assert.equal(admit("rewrite", ESTIMATE, DEFAULT_LIMITS, used, idle).ok, true);
});

test("write calls need credits from an admitted outline, so the generation cap can't be skipped", () => {
  assert.equal(admit("write", ESTIMATE, DEFAULT_LIMITS, fresh, idle).ok, false);
  assert.equal(admit("write", ESTIMATE, DEFAULT_LIMITS, { ...fresh, writeCredits: 1 }, idle).ok, true);
});

test("an outline grants enough write calls for every batch and the client's retries", () => {
  assert.equal(writeCallsFor(1), 3);
  assert.equal(writeCallsFor(WRITE_BATCH), 3);
  assert.equal(writeCallsFor(WRITE_BATCH + 1), 6);
  assert.equal(writeCallsFor(120), 90);
});

test("an account with too many calls running is told to wait, not that its allowance is spent", () => {
  const busy = admit("rewrite", ESTIMATE, DEFAULT_LIMITS, { ...fresh, running: DEFAULT_LIMITS.userConcurrentCalls }, idle);
  assert.equal(busy.ok, false);
  assert.equal(!busy.ok && busy.busy, true);
  assert.equal(admit("rewrite", ESTIMATE, DEFAULT_LIMITS, { ...fresh, running: DEFAULT_LIMITS.userConcurrentCalls - 1 }, idle).ok, true);
});

test("exempt operators are admitted past every allowance", () => {
  const exhausted = { tokens: DEFAULT_LIMITS.userDailyTokens, reserved: 0, generations: DEFAULT_LIMITS.userDailyGenerations, running: 99, writeCredits: 0 };
  const shared = { tokens: DEFAULT_LIMITS.globalDailyTokens, reserved: 0 };
  assert.equal(admit("outline", ESTIMATE, DEFAULT_LIMITS, exhausted, shared).ok, false);
  assert.equal(admit("outline", ESTIMATE, DEFAULT_LIMITS, exhausted, shared, true).ok, true);
  assert.equal(admit("write", ESTIMATE, DEFAULT_LIMITS, exhausted, shared, true).ok, true);
});

test("a reservation covers the most a call can use: its text, images, instructions, and full output", () => {
  const text = worstCaseTokens({ textBytes: 100_000, images: 0, maxOutput: 16_000 });
  assert.ok(text >= 100_000 / 4 + 16_000, "at least English's ~4 bytes per token plus the whole output");
  assert.ok(worstCaseTokens({ textBytes: 0, images: 6, maxOutput: 4_000 }) > worstCaseTokens({ textBytes: 0, images: 0, maxOutput: 4_000 }));
});

test("concurrent worst-case reservations can't take an account past its daily tokens", () => {
  // The largest rewrite the schema accepts, reserved again and again as if all ran at once.
  const estimate = worstCaseTokens({ textBytes: 60_000, images: 0, maxOutput: maxOutputTokens() });
  let user = { ...fresh, running: 0 };
  while (admit("rewrite", estimate, { ...DEFAULT_LIMITS, userConcurrentCalls: 1_000 }, user, idle).ok) user = { ...user, reserved: user.reserved + estimate };
  assert.ok(user.reserved <= DEFAULT_LIMITS.userDailyTokens);
});

test("write output is clamped to the provider's ceiling however many words are asked for", () => {
  const request = { slides: Array.from({ length: 6 }, () => ({ targetWords: 5000 })) } as unknown as WriteRequest;
  assert.equal(maxOutputTokens(writeOutputLimit(request)), 48_000);
  assert.equal(maxOutputTokens(), 16_000);
});

test("a rewrite's script text is capped in total, not only per paragraph", () => {
  const brief = { goal: "", audience: "", keyMessage: "", mustInclude: "", avoid: "", presenterRole: "", minutes: 5, qaMinutes: 0, wpm: 130, style: "conversational", depth: "full", includeQuestions: false };
  const slide = { title: "", text: "", notes: "", analysis: null, previousTitle: "", nextTitle: "" };
  const base = { kind: "support", brief, title: "", slide };
  assert.equal(RewriteRequest.safeParse({ ...base, paragraphs: Array(7).fill("word ".repeat(800)) }).success, true);
  const oversized = Array(40).fill("x".repeat(4000));
  assert.equal(RewriteRequest.safeParse({ ...base, paragraphs: oversized }).success, false);
  // The client trims a long script to fit, keeping its blank paragraphs and its start.
  const fitted = fitScriptParagraphs(["", ...oversized]);
  assert.equal(fitted[0], "");
  assert.equal(fitted.reduce((sum, paragraph) => sum + paragraph.length, 0), SCRIPT_LIMITS.totalChars);
  assert.equal(RewriteRequest.safeParse({ ...base, paragraphs: fitted }).success, true);
});

test("the exempt list matches verified emails exactly, ignoring case and spacing", () => {
  const list = " Boss@Example.com , second@example.com";
  assert.equal(quotaExempt("boss@example.com", list), true);
  assert.equal(quotaExempt("second@example.com", list), true);
  assert.equal(quotaExempt("someone@example.com", list), false);
  assert.equal(quotaExempt("boss@example.co", list), false);
  assert.equal(quotaExempt(null, list), false);
  assert.equal(quotaExempt("boss@example.com", ""), false);
});

test("usage sums input and output tokens across calls", () => {
  const call = { stage: "write", model: "m", promptHash: "", effort: "", milliseconds: 1, reasoningTokens: 0, cachedTokens: 0, status: "ok", requestId: "" };
  assert.equal(usedTokens({ promptVersion: "v", calls: [{ ...call, inputTokens: 100, outputTokens: 50 }, { ...call, inputTokens: 10, outputTokens: 5 }] }), 165);
  assert.equal(usedTokens(undefined), 0);
});

test("days roll over at UTC midnight", () => {
  assert.equal(utcDay(new Date("2026-09-27T23:59:59Z")), "2026-09-27");
  assert.equal(utcDay(new Date("2026-09-28T00:00:00Z")), "2026-09-28");
});
