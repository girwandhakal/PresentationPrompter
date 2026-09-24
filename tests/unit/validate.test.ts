import assert from "node:assert/strict";
import test from "node:test";
import { finalizeWrittenSlide, needsRepair, sanitizeCues, ungroundedNumbers } from "../../lib/ai/validate";
import type { BriefInput, WriteSlideInput, WrittenSlideOutput } from "../../lib/ai/schemas";

const brief: BriefInput = {
  goal: "Get approval for a one-month pilot",
  audience: "Product leads",
  keyMessage: "",
  mustInclude: "",
  avoid: "",
  presenterRole: "",
  minutes: 8,
  qaMinutes: 0,
  wpm: 130,
  style: "conversational",
  depth: "full",
  cueDensity: "light",
  includeQuestions: true,
};

const input: WriteSlideInput = {
  id: "s1",
  index: 1,
  title: "Clarity is compounding",
  text: "Activation rose from 61% to 74% in six weeks.",
  notes: "",
  analysis: null,
  role: "",
  keyIdea: "",
  transition: "",
  targetWords: 60,
  previousTitle: "",
  nextTitle: "",
};

const output = (values: Partial<WrittenSlideOutput> = {}): WrittenSlideOutput => ({
  id: "s1",
  purpose: "Shows the signal.",
  paragraphs: ["Activation rose from 61% to 74%.", "That's the signal."],
  cues: [],
  concise: "Activation is up.",
  keywords: ["activation"],
  recovery: "The point: activation is up.",
  transition: "Next, the plan.",
  questions: [{ question: "Why?", answer: "Onboarding got easier." }],
  flags: [],
  ...values,
});

test("figures that aren't in the source are flagged; grounded ones are not", () => {
  assert.deepEqual(ungroundedNumbers(["We grew 74% and then 90%."], ["Activation rose from 61% to 74%."]), ["90%"]);
  assert.deepEqual(ungroundedNumbers(["Revenue hit $2,400 in 2023."], ["Revenue $2400", "2023 results"]), []);
  // Single-digit counting words are allowed.
  assert.deepEqual(ungroundedNumbers(["Three moves, step 2 first."], ["Three deliberate moves"]), []);
});

test("finalize adds an unsupported-claim flag for invented figures", () => {
  const result = finalizeWrittenSlide(output({ paragraphs: ["Activation hit 95% this quarter."] }), input, brief);
  assert.ok(result.flags.some((flag) => flag.kind === "unsupported-claim" && flag.message.includes("95%")));
});

test("finalize trims, caps, and drops questions when not requested", () => {
  const result = finalizeWrittenSlide(output({ paragraphs: ["  “Quoted.”  ", "", "Second."], keywords: ["a", "b", "c", "d", "e", "f", "g"] }), input, { ...brief, includeQuestions: false });
  assert.deepEqual(result.paragraphs, ["Quoted.", "Second."]);
  assert.equal(result.keywords.length, 6);
  assert.deepEqual(result.questions, []);
  assert.equal(result.id, "s1");
});

test("cue anchors are clamped to real paragraphs and sentences, and capped by density", () => {
  const paragraphs = ["One. Two.", "Three."];
  const cues = sanitizeCues([
    { paragraph: 5, afterSentence: 9, type: "pause", text: "Pause" },
    { paragraph: 1, afterSentence: 0, type: "look", text: "Look up" },
    { paragraph: 1, afterSentence: 1, type: "gesture", text: "Point" },
  ], paragraphs, "light");
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { paragraph: 2, afterSentence: 1, type: "pause", text: "Pause" });
  assert.deepEqual(cues[1], { paragraph: 1, afterSentence: 1, type: "look", text: "Look up" });
  assert.equal(sanitizeCues(cues, paragraphs, "none").length, 0);
});

test("repair is only attempted when a slide is meaningfully off its word budget", () => {
  assert.equal(needsRepair(100, 100, "full"), false);
  assert.equal(needsRepair(125, 100, "full"), true);
  assert.equal(needsRepair(125, 100, "notes"), false);
  assert.equal(needsRepair(40, 10, "full"), false, "tiny targets are never repaired");
});
