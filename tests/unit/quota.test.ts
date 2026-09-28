import assert from "node:assert/strict";
import { test } from "node:test";
import { admit, DEFAULT_LIMITS, quotaExempt, usedTokens, utcDay } from "../../lib/ai/server/quota";

const fresh = { tokens: 0, reserved: 0, generations: 0 };
const idle = { tokens: 0, reserved: 0 };

test("admits a call within every allowance and reserves an estimate", () => {
  const decision = admit("write", DEFAULT_LIMITS, fresh, idle);
  assert.equal(decision.ok, true);
  assert.ok(decision.ok && decision.estimate > 0);
});

test("counts in-flight reservations against the user's daily tokens", () => {
  const nearlyFull = { ...fresh, tokens: 350_000, reserved: 40_000 };
  const decision = admit("write", DEFAULT_LIMITS, nearlyFull, idle);
  assert.equal(decision.ok, false);
});

test("the shared app-wide allowance is first come", () => {
  const decision = admit("analyze", DEFAULT_LIMITS, fresh, { tokens: 1_990_000, reserved: 0 });
  assert.equal(decision.ok, false);
  assert.match(!decision.ok ? decision.message : "", /shared/);
});

test("only new generations (outline) are capped per day", () => {
  const used = { ...fresh, generations: DEFAULT_LIMITS.userDailyGenerations };
  assert.equal(admit("outline", DEFAULT_LIMITS, used, idle).ok, false);
  assert.equal(admit("rewrite", DEFAULT_LIMITS, used, idle).ok, true);
});

test("exempt operators are admitted past every allowance, with the usual reservation", () => {
  const exhausted = { tokens: DEFAULT_LIMITS.userDailyTokens, reserved: 0, generations: DEFAULT_LIMITS.userDailyGenerations };
  const shared = { tokens: DEFAULT_LIMITS.globalDailyTokens, reserved: 0 };
  assert.equal(admit("outline", DEFAULT_LIMITS, exhausted, shared).ok, false);
  const decision = admit("outline", DEFAULT_LIMITS, exhausted, shared, true);
  assert.ok(decision.ok && decision.estimate > 0);
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
