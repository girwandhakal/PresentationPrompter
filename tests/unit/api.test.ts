import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as analyze } from "../../app/api/ai/analyze/route";
import { POST as context } from "../../app/api/ai/context/route";
import { POST as deliver } from "../../app/api/ai/deliver/route";
import { POST as outline } from "../../app/api/ai/outline/route";
import { POST as rewrite } from "../../app/api/ai/rewrite/route";
import { GET as status } from "../../app/api/ai/status/route";
import { POST as write } from "../../app/api/ai/write/route";
import type { BriefInput } from "../../lib/ai/schemas";

// These run the real route handlers against the deterministic demo provider — no network.
beforeEach(() => {
  process.env.AI_PROVIDER = "demo";
  delete process.env.OPENAI_API_KEY;
});

// Route responses are plain JSON; the assertions below check their shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const body = async (response: Response): Promise<Json> => response.json();

let client = 0;
function post(body: unknown) {
  // A distinct client address per request keeps the best-effort rate limiter out of the way.
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++client % 250}` },
    body: JSON.stringify(body),
  });
}

const brief: BriefInput = {
  goal: "Get approval for a one-month pilot",
  audience: "Product leads",
  keyMessage: "Start small and learn",
  mustInclude: "",
  avoid: "",
  presenterRole: "",
  minutes: 6,
  qaMinutes: 1,
  wpm: 130,
  style: "conversational",
  depth: "full",
  cueDensity: "light",
  includeQuestions: true,
};

const slides = [
  { id: "a1", index: 1, title: "A quieter way to launch", text: "A quieter way to launch\nStart small, learn quickly, scale when the signal is clear.", notes: "" },
  { id: "b2", index: 2, title: "Clarity is compounding", text: "Clarity is compounding\nActivation rose from 61% to 74% in six weeks.\nTraffic stayed flat.", notes: "" },
  { id: "c3", index: 3, title: "The ask", text: "The ask\nOne focused month. One shared measure of success.", notes: "" },
];

test("status reports the active provider", async () => {
  assert.deepEqual(await body(await status()), { provider: "demo", model: null });
});

test("the full pipeline returns grounded, budgeted scripts for every slide", async () => {
  const analyzed = await body(await analyze(post({ fileName: "deck.pdf", slideCount: 3, slides: slides.map((slide) => ({ ...slide, image: null })) })));
  assert.deepEqual(analyzed.slides.map((slide: { id: string }) => slide.id), ["a1", "b2", "c3"]);
  for (const entry of analyzed.slides) {
    assert.ok(entry.analysis.complexity >= 1 && entry.analysis.complexity <= 5);
    assert.ok(entry.analysis.mainPoint.length > 0);
  }

  const deck = await body(await context(post({ fileName: "deck.pdf", slides: slides.map((slide, index) => ({ index: index + 1, title: slide.title, mainPoint: analyzed.slides[index].analysis.mainPoint, kind: "content" })) })));
  assert.ok(deck.context.suggestedGoal.length > 0);

  const planned = await body(await outline(post({ brief, context: null, title: "Launch", slides: slides.map((slide, index) => ({ id: slide.id, index: index + 1, title: slide.title, mainPoint: "", kind: "content", targetWords: 90, optional: false })) })));
  assert.equal(planned.slides.length, 3);
  assert.ok(planned.arc.length > 0);

  const written = await body(await write(post({
    brief,
    context: null,
    title: "Launch",
    arc: planned.arc,
    totalSlides: 3,
    slides: slides.map((slide, index) => ({
      ...slide,
      analysis: null,
      role: planned.slides[index].role,
      keyIdea: planned.slides[index].keyIdea,
      transition: planned.slides[index].transition,
      targetWords: 60,
      previousTitle: slides[index - 1]?.title ?? "",
      nextTitle: slides[index + 1]?.title ?? "",
    })),
  })));
  assert.equal(written.slides.length, 3);
  for (const entry of written.slides) {
    assert.ok(entry.script, `slide ${entry.id} has a script`);
    assert.ok(entry.script.paragraphs.length > 0);
    assert.ok(entry.script.cues.length <= 2, "light cue density caps cues");
    for (const cue of entry.script.cues) assert.ok(cue.paragraph >= 1 && cue.paragraph <= entry.script.paragraphs.length);
    assert.ok(entry.script.questions.length >= 1);
  }
});

test("deliver marks pauses, bold and slow across a written deck", async () => {
  const response = await deliver(post({
    density: "detailed",
    slides: [
      { id: "a1", title: "A quieter way to launch", kind: "title", keyIdea: "", first: true, paragraphs: ["Thanks for being here. Today is about launching quietly."] },
      { id: "b2", title: "Clarity is compounding", kind: "chart", keyIdea: "Activation rose from 61% to 74% in six weeks", first: false, paragraphs: ["Why does clarity matter? Activation rose from 61% to 74% in six weeks.", "But traffic stayed flat, so the gain came from the product itself."] },
    ],
  }));
  assert.equal(response.status, 200);
  const { slides: delivered } = await body(response);
  assert.deepEqual(delivered.map((slide: { id: string }) => slide.id), ["a1", "b2"]);
  const chart = delivered[1];
  assert.ok(chart.cues.length >= 1 && chart.cues.every((cue: { text: string }) => cue.text === "Pause"));
  assert.ok(chart.cues.some((cue: { paragraph: number; afterSentence: number }) => cue.paragraph === 1 && cue.afterSentence === 1), "the question gets a pause");
  assert.ok(chart.marks.every((mark: { sentence: number }) => mark.sentence >= 1));
});

test("rewrite supports script, selection, support, and questions requests", async () => {
  const base = { brief, title: "Launch", slide: { title: "Clarity", text: "Activation rose.", notes: "", analysis: null, previousTitle: "Intro", nextTitle: "Plan" }, paragraphs: ["Activation rose from 61% to 74%. That matters."] };
  const script = await body(await rewrite(post({ ...base, kind: "script", action: "fit", targetWords: 20 })));
  assert.equal(script.kind, "script");
  assert.ok(script.paragraphs.length > 0);
  const selection = await body(await rewrite(post({ ...base, kind: "selection", action: "shorter", selection: "Activation rose from sixty one to seventy four percent" })));
  assert.ok(selection.text.split(" ").length < 10);
  const support = await body(await rewrite(post({ ...base, kind: "support" })));
  assert.ok(support.recovery && support.transition && Array.isArray(support.keywords));
  const questions = await body(await rewrite(post({ ...base, kind: "questions" })));
  assert.ok(questions.questions.length > 0);
});

test("invalid, oversized, and unconfigured requests fail with clear codes", async () => {
  const invalid = await analyze(post({ fileName: "x", slideCount: 1, slides: [] }));
  assert.equal(invalid.status, 400);
  assert.equal((await body(invalid)).code, "invalid_request");

  const huge = await outline(new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json", "content-length": String(50 * 1024 * 1024) }, body: "{}" }));
  assert.equal(huge.status, 413);

  const badJson = await context(new Request("http://localhost/api/ai", { method: "POST", body: "{not json" }));
  assert.equal(badJson.status, 400);

  delete process.env.AI_PROVIDER;
  const previous = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  try {
    const unavailable = await context(post({ fileName: "x", slides: [{ index: 1, title: "t", mainPoint: "m", kind: "content" }] }));
    assert.equal(unavailable.status, 503);
    assert.equal((await body(unavailable)).code, "ai_unavailable");
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previous;
  }
});

test("images must be image data URLs", async () => {
  const response = await analyze(post({ fileName: "deck.pdf", slideCount: 1, slides: [{ ...slides[0], image: "https://example.com/tracker.png" }] }));
  assert.equal(response.status, 400);
});
