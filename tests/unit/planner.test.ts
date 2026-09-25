import assert from "node:assert/strict";
import test from "node:test";
import { clampBrief, DEFAULT_BRIEF, planPresentation, planSummary, withoutQaTime } from "../../lib/domain/planner";
import type { Brief, SlideAnalysis } from "../../lib/domain/types";

type PlanSlide = Parameters<typeof planPresentation>[1][number];

const slide = (id: string, words: number, extra: Partial<PlanSlide> = {}): PlanSlide => ({
  id,
  text: Array.from({ length: words }, (_, index) => `word${index}`).join(" "),
  analysis: null,
  optional: false,
  targetSeconds: null,
  ...extra,
});

const brief = (values: Partial<Brief> = {}): Brief => ({ ...DEFAULT_BRIEF, ...values });

test("an 8-minute talk at 130 wpm has a ~1,040 word raw budget and a smaller usable one", () => {
  const plan = planPresentation(brief(), [slide("a", 30), slide("b", 30)]);
  assert.equal(plan.speakingSeconds, 480);
  assert.equal(plan.rawWords, 1040);
  assert.equal(plan.usableWords, Math.round(1040 * 0.88));
  assert.ok(plan.range[0] < plan.range[1]);
});

test("Q&A time is taken out of speaking time", () => {
  const plan = planPresentation(brief({ minutes: 10, qaMinutes: 2 }), [slide("a", 30)]);
  assert.equal(plan.speakingSeconds, 8 * 60);
});

test("slide allocations add up to the speaking time and favor denser slides", () => {
  const slides = [slide("title", 5), slide("dense", 120), slide("normal", 40)];
  const plan = planPresentation(brief(), slides);
  const total = plan.slides.reduce((sum, entry) => sum + entry.seconds, 0);
  assert.ok(Math.abs(total - plan.speakingSeconds) <= slides.length, `allocated ${total}s of ${plan.speakingSeconds}s`);
  const [title, dense, normal] = plan.slides;
  assert.ok(dense.seconds > normal.seconds && normal.seconds > title.seconds);
});

test("AI complexity overrides the text heuristic", () => {
  const analysis = (complexity: number): SlideAnalysis => ({ title: "", mainPoint: "", visualSummary: "", elements: [], complexity, kind: "chart", uncertain: [] });
  const plan = planPresentation(brief(), [slide("chart", 5, { analysis: analysis(5) }), slide("text", 90, { analysis: analysis(1) })]);
  assert.ok(plan.slides[0].seconds > plan.slides[1].seconds);
});

test("optional slides get no time and pinned targets are respected", () => {
  const plan = planPresentation(brief(), [slide("a", 30, { optional: true }), slide("b", 30, { targetSeconds: 120 }), slide("c", 30)]);
  assert.equal(plan.slides[0].seconds, 0);
  assert.equal(plan.slides[0].words, 0);
  assert.equal(plan.slides[1].seconds, 120);
  assert.equal(plan.slides[1].pinned, true);
  assert.equal(plan.slides[2].seconds, 480 - 120);
  assert.equal(plan.includedSlides, 2);
});

test("script depth scales written words, not speaking time", () => {
  const full = planPresentation(brief({ depth: "full" }), [slide("a", 30)]);
  const notes = planPresentation(brief({ depth: "notes" }), [slide("a", 30)]);
  assert.equal(full.slides[0].seconds, notes.slides[0].seconds);
  assert.ok(notes.slides[0].words < full.slides[0].words / 2);
});

test("inconsistent settings produce a warning", () => {
  const tight = planPresentation(brief({ minutes: 2 }), Array.from({ length: 20 }, (_, index) => slide(String(index), 40)));
  assert.ok(tight.warnings.some((warning) => warning.level === "warn" && /tight/.test(warning.message)));
  const none = planPresentation(brief(), [slide("a", 10, { optional: true })]);
  assert.ok(none.warnings.some((warning) => /optional/.test(warning.message)));
});

test("clampBrief keeps values in range and Q&A shorter than the talk", () => {
  const clamped = clampBrief(brief({ minutes: 0, qaMinutes: 99, wpm: 1000 }));
  assert.equal(clamped.minutes, 1);
  assert.equal(clamped.qaMinutes, 0);
  assert.equal(clamped.wpm, 220);
  assert.equal(clampBrief(brief({ minutes: Number.NaN })).minutes, DEFAULT_BRIEF.minutes);
});

test("the plan summary reads like the setup review line", () => {
  const value = brief({ qaMinutes: 2 });
  const summary = planSummary(value, planPresentation(value, [slide("a", 20), slide("b", 20)]));
  assert.match(summary, /^8 min · 130 wpm · ~[\d,]+–[\d,]+ spoken words · 2 slides · 2 min Q&A$/);
});

test("folding old Q&A time into the total keeps speaking time unchanged", () => {
  const before = brief({ minutes: 10, qaMinutes: 2 });
  const after = withoutQaTime(before);
  assert.equal(after.minutes, 8);
  assert.equal(after.qaMinutes, 0);
  assert.equal(planPresentation(after, [slide("a", 30)]).speakingSeconds, planPresentation(before, [slide("a", 30)]).speakingSeconds);
  // Nothing to fold: the same object comes back.
  const plain = brief({ minutes: 10, qaMinutes: 0 });
  assert.equal(withoutQaTime(plain), plain);
});
