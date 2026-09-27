import assert from "node:assert/strict";
import { test } from "node:test";
import { pickDraft, spokenProblems, ungroundedFigures } from "../../lib/ai/server/spoken-lint";

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

test("flags sales-deck language", () => {
  assert.match(spokenProblems(["This is a real game-changer for the team."]).join(" "), /sales-deck/);
  assert.match(spokenProblems(["Let's delve into the numbers."]).join(" "), /sales-deck/);
});

test("flags figures the source material doesn't contain, but not small counts", () => {
  const source = "Activation rose from 61% to 74% in six weeks. Twelve body areas. Revenue $1,200,000.";
  assert.deepEqual(ungroundedFigures(["Activation went from 61% to 74%, across 12 areas, about 1,200,000 dollars, in two steps and 3 weeks."], source), []);
  assert.deepEqual(ungroundedFigures(["Activation jumped 83% and saved 40 hours, fixing #42."], source), ["83", "40"]);
  assert.match(spokenProblems(["Activation jumped 83% in a month."], source).join(" "), /"83"/);
  assert.deepEqual(spokenProblems(["Activation jumped 83% in a month."]), [], "no source, no grounding check");
});

test("a retry replaces only the slides it improved", () => {
  const first = { slides: [slide("a", notes), slide("b", spoken)] };
  const fixed = { slides: [slide("a", spoken), slide("b", spoken)] };
  assert.deepEqual(pickDraft(first, fixed), fixed);
  assert.equal(pickDraft(first, null), first, "a failed retry keeps the first draft");
  // A slide the retry dropped, or made worse, keeps its first version; label openers in the concise summary count too.
  const worse = { ...slide("b", spoken), concise: "Result: faster." };
  assert.deepEqual(pickDraft(first, { slides: [slide("a", spoken), worse] }).slides, [slide("a", spoken), slide("b", spoken)]);
  assert.deepEqual(pickDraft(first, { slides: [slide("a", spoken)] }).slides, [slide("a", spoken), slide("b", spoken)]);
  // A slide that was already fine keeps its first version, even when the retry's is also fine.
  const rewritten = slide("b", "We made checkout faster by asking only for what we need.");
  assert.deepEqual(pickDraft(first, { slides: [slide("a", spoken), rewritten] }).slides[1], slide("b", spoken));
});
