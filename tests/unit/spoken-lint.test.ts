import assert from "node:assert/strict";
import { test } from "node:test";
import { pickDraft, spokenProblems } from "../../lib/ai/server/spoken-lint";

test("flags label-and-colon openers", () => {
  assert.ok(spokenProblems(["Keep: small PRs, peer review."]).length);
  assert.ok(spokenProblems(["Short version: the form failed."]).length);
  assert.ok(spokenProblems(["We did well. Fix: project fields fell behind."]).length);
  assert.ok(spokenProblems(["Second, external dependencies: EmailJS configuration blocks live submission."]).length);
});

test("flags clipped notes and ticket recitals", () => {
  assert.ok(spokenProblems(["Data done. UI done. Tests pass. CI green."]).length);
  assert.ok(spokenProblems(["The tickets were #42, #46, and #52 plus #5 overall."]).length);
});

test("accepts natural spoken sentences", () => {
  assert.deepEqual(spokenProblems(["So the goal was simple: get people through checkout faster. We cut the form down to the fields people actually need, and it came out about twenty percent quicker."]), []);
  assert.deepEqual(spokenProblems([]), []);
});

const spoken = "So the goal was simple: get people through checkout faster. We cut the form down to the fields people actually need.";
const notes = "Keep: small PRs, peer review.";
const slide = (id: string, text: string) => ({ id, paragraphs: [text], concise: "The form got faster." });

test("a retry wins only when it is no worse and covers every slide", () => {
  const first = { slides: [slide("a", notes), slide("b", spoken)] };
  const fixed = { slides: [slide("a", spoken), slide("b", spoken)] };
  assert.equal(pickDraft(first, fixed), fixed);
  // A failed retry, or one that drops a slide, keeps the first draft.
  assert.equal(pickDraft(first, null), first);
  assert.equal(pickDraft(first, { slides: [slide("a", spoken)] }), first);
  // A retry with more failing slides loses; label openers in the concise summary count too.
  assert.equal(pickDraft(first, { slides: [slide("a", notes), { ...slide("b", spoken), concise: "Result: faster." }] }), first);
});
