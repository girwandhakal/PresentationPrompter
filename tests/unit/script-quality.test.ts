import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BRIEF, planPresentation } from "../../lib/domain/planner";
import { exactIds, AiOutputError } from "../../lib/ai/server/integrity";
import { quantities, unsupportedQuantities } from "../../lib/ai/server/quantities";
import { draftNotes, slideSource, spokenProblems } from "../../lib/ai/server/spoken-lint";
import { writeInstructions, writeText } from "../../lib/ai/server/prompts";
import { relevantExamples } from "../../lib/ai/server/writing-guide";

const source = { id: "s1", index: 1, title: "Pilot", text: "A five-user pilot is planned. Estimated cost: 900 dollars.", notes: "The pilot has not started.", analysis: null, role: "decision", keyIdea: "", transition: "", previousTransition: "", previousTitle: "", nextTitle: "", targetWords: 40 };
const script = (text: string) => ({ paragraphs: [text], concise: "", recovery: "", transition: "" });

test("identity matching rejects missing, duplicate, foreign and duplicate requested IDs", () => {
  assert.throws(() => exactIds([{ id: "a" }, { id: "b" }], [{ id: "b" }]), AiOutputError);
  assert.throws(() => exactIds([{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "a" }]), AiOutputError);
  assert.throws(() => exactIds([{ id: "a" }], [{ id: "b" }]), AiOutputError);
  assert.throws(() => exactIds([{ id: "a" }, { id: "a" }], [{ id: "a" }]), AiOutputError);
  assert.equal(exactIds([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "a" }]).get("a")?.id, "a");
});

test("quantity diagnostics normalize spoken numbers, scales and currency but preserve units", () => {
  assert.equal(quantities("ninety-nine dollars")[0].value, "99");
  assert.equal(quantities("three million dollars")[0].value, "3000000");
  assert.equal(quantities("3 million dollars")[0].value, "3000000");
  assert.deepEqual(unsupportedQuantities("1,200,000 dollars", "Revenue $1,200,000."), []);
  assert.equal(unsupportedQuantities("five weeks", "five days").length, 1);
  assert.equal(unsupportedQuantities("five percent", "five percentage points").length, 1);
  assert.equal(unsupportedQuantities("ninety-nine dollars", "61 dollars").length, 1);
  assert.deepEqual(unsupportedQuantities("six weeks", "week 6"), []);
});

test("timing, plans and voice samples never become numerical evidence", () => {
  const brief = { ...DEFAULT_BRIEF, minutes: 17, voiceSample: "Our revenue is 83 dollars." };
  const material = slideSource({ ...source, keyIdea: "Revenue 100 dollars" } as typeof source, brief);
  assert.equal(unsupportedQuantities("17 dollars, 83 dollars, 100 dollars", material).length, 3);
});

test("draft notes flag invented figures but accept figures from neighboring slides in the batch", () => {
  const neighbor = { ...source, id: "s2", title: "Result", text: "Result: 12 percent.", notes: "" };
  const evidence = [source, neighbor].map((slide) => slideSource(slide, DEFAULT_BRIEF)).join("\n");
  assert.deepEqual(draftNotes({ ...source, script: script("The neighboring result is twelve percent.") }, evidence, DEFAULT_BRIEF), []);
  assert.ok(draftNotes({ ...source, script: script("The pilot costs ninety-nine dollars.") }, evidence, DEFAULT_BRIEF).some((issue) => issue.category === "fidelity"));
});

test("notes and cue modes accept fragments while full speech flags clause piles", () => {
  assert.deepEqual(spokenProblems(["Pilot scope. Five users. Approval needed."], undefined, "notes"), []);
  assert.deepEqual(spokenProblems(["Scope: pilot"], undefined, "cues"), []);
  assert.deepEqual(spokenProblems(["First, upload the file. Then validate it. Save it only after validation succeeds."]), []);
  assert.ok(spokenProblems([Array(37).fill("word").join(" ") + "."]).length);
  assert.doesNotMatch(writeInstructions({ ...DEFAULT_BRIEF, depth: "cues" }), /Writing for speech|Write complete, comfortable spoken sentences/);
});

test("the writer is told which slide greets and which thanks", () => {
  assert.match(writeInstructions(DEFAULT_BRIEF), /first slide of the talk opens with a short greeting/);
  const request = { brief: DEFAULT_BRIEF, title: "Pilot", arc: "", voice: "", context: null, totalSlides: 3, slides: [source, { ...source, id: "s3", index: 3 }] };
  const text = writeText(request);
  assert.match(text, /Opening slide: begin with a short greeting/);
  assert.match(text, /Closing slide: end by thanking the audience/);
  assert.equal(text.match(/Opening slide/g)?.length, 1);
});

test("change-summary examples are selected for progress lists without replacing ordered-step examples", () => {
  const request = { brief: DEFAULT_BRIEF, title: "Sprint review", arc: "", voice: "", context: null, totalSlides: 1, slides: [{ ...source, title: "Changes made", text: "Adjusted spacing. Updated labels. Fixed validation. Preserved entered values." }] };
  assert.match(relevantExamples(request), /The slide carries the full list/);
  const diagram = { mainPoint: "", visualSummary: "", elements: [], uncertain: [], complexity: 2, kind: "diagram" };
  assert.match(relevantExamples({ ...request, slides: [{ ...request.slides[0], analysis: diagram }] }), /First, upload the file\. Then validate it/);
});

test("sparse dividers redistribute time and cue prompts never inflate to full speech", () => {
  const analysis = { title: "Risks", mainPoint: "", visualSummary: "", elements: [], uncertain: [], complexity: 1, kind: "section" as const };
  const slides = [{ id: "divider", text: "Deployment risks", notes: "", analysis, optional: false, targetSeconds: null }, { id: "evidence", text: "Evidence and explanation", notes: "", analysis: null, optional: false, targetSeconds: null }];
  const plan = planPresentation(DEFAULT_BRIEF, slides);
  assert.equal(plan.slides[0].seconds, 20);
  assert.equal(plan.slides[0].seconds + plan.slides[1].seconds, plan.speakingSeconds);
  assert.ok(planPresentation({ ...DEFAULT_BRIEF, depth: "cues" }, slides).slides.every((entry) => entry.words <= 30));
});
