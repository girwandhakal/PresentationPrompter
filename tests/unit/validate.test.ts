import assert from "node:assert/strict";
import test from "node:test";
import { finalizeWrittenSlide, needsRepair } from "../../lib/ai/validate";
import type { BriefInput, WriteSlideInput, WrittenSlideDraft } from "../../lib/ai/schemas";

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
  previousTransition: "",
  targetWords: 60,
  previousTitle: "",
  nextTitle: "",
};

const output = (values: Partial<WrittenSlideDraft> = {}): WrittenSlideDraft => ({
  id: "s1",
  purpose: "Shows the signal.",
  paragraphs: ["Activation rose from 61% to 74%.", "That's the signal."],
  concise: "Activation is up.",
  keywords: ["activation"],
  recovery: "The point: activation is up.",
  transition: "Next, the plan.",
  questions: [{ question: "Why?", answer: "Onboarding got easier." }],
  ...values,
});

test("finalize trims, caps, and drops questions when not requested", () => {
  const result = finalizeWrittenSlide(output({ paragraphs: ["  “Quoted.”  ", "", "Second."], keywords: ["a", "b", "c", "d", "e", "f", "g"] }), input, { ...brief, includeQuestions: false });
  assert.deepEqual(result.paragraphs, ["Quoted.", "Second."]);
  assert.equal(result.keywords.length, 6);
  assert.deepEqual(result.questions, []);
  assert.equal(result.id, "s1");
});

test("finalize places cues and marks from the prose and respects the density setting", () => {
  const paragraphs = ["Why did activation move? We changed one thing in onboarding, and activation rose to 74% in six weeks.", "Traffic stayed flat, so the gain came from clarity."];
  const light = finalizeWrittenSlide(output({ paragraphs }), input, brief);
  assert.deepEqual(light.cues, [{ paragraph: 1, afterSentence: 1, type: "pause", text: "Pause" }]);
  assert.deepEqual(light.marks, [{ paragraph: 1, sentence: 2, text: "74%", mark: "bold" }]);
  const none = finalizeWrittenSlide(output({ paragraphs }), input, { ...brief, cueDensity: "none" });
  assert.deepEqual([none.cues, none.marks], [[], []]);
});

test("repair is only attempted when a slide is meaningfully off its word budget", () => {
  assert.equal(needsRepair(100, 100, "full"), false);
  assert.equal(needsRepair(125, 100, "full"), true);
  assert.equal(needsRepair(125, 100, "notes"), false);
  assert.equal(needsRepair(40, 10, "full"), false, "tiny targets are never repaired");
});
