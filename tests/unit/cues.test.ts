import assert from "node:assert/strict";
import test from "node:test";
import { placeDelivery, type DeliveryContext } from "../../lib/domain/cues";
import { documentFromAi, splitSentences } from "../../lib/domain/script";

const place = (context: Partial<DeliveryContext> & Pick<DeliveryContext, "paragraphs">) => placeDelivery({ density: "detailed", seed: "slide-1", ...context });
const cuesOf = (context: Partial<DeliveryContext> & Pick<DeliveryContext, "paragraphs">) => place(context).cues;

test("nothing is placed when density is none or the script is empty", () => {
  assert.deepEqual(place({ paragraphs: ["Activation rose to 74%. Why?"], density: "none" }), { cues: [], marks: [] });
  assert.deepEqual(place({ paragraphs: [] }), { cues: [], marks: [] });
  assert.deepEqual(place({ paragraphs: ["   "] }), { cues: [], marks: [] });
});

test("the only cue line is Pause, even when a sentence refers to the visual", () => {
  const cues = cuesOf({
    paragraphs: ["So why did the form stop sending? The credentials had expired.", "But you can see on the chart that submissions recovered by 40%. We swapped in test ones to keep going."],
    kind: "chart",
    first: true,
  });
  assert.ok(cues.length > 0);
  for (const cue of cues) assert.deepEqual([cue.type, cue.text], ["pause", "Pause"]);
});

test("a key figure is bolded instead of getting a cue line", () => {
  const { cues, marks } = place({ paragraphs: ["We simplified the signup form. Completion rose to 65% in a month. That held for every region."], density: "light" });
  assert.deepEqual(marks, [{ paragraph: 1, sentence: 2, text: "65%", mark: "bold" }]);
  assert.ok(cues.every((cue) => cue.type !== ("emphasis" as string)));
});

test("ticket numbers and dates are not treated as figures", () => {
  const { marks } = place({ paragraphs: ["We merged the fix in #42 and #45 on September 24. The form sends again. Next we clean up the backlog."] });
  assert.deepEqual(marks.filter((mark) => mark.mark === "bold"), []);
});

test("a question gets a pause after it, never after the final sentence", () => {
  assert.deepEqual(cuesOf({ paragraphs: ["So why did the form stop sending? The credentials had expired. We swapped in test ones to keep going."], density: "light" }), [{ paragraph: 1, afterSentence: 1, type: "pause", text: "Pause" }]);
  assert.deepEqual(cuesOf({ paragraphs: ["We covered a lot today. Any questions?"], density: "light" }), []);
});

test("chart slides open with a pause so the audience can read the chart", () => {
  assert.deepEqual(cuesOf({ paragraphs: ["Revenue grew steadily through the year. The spring dip was a pricing test."], kind: "chart", density: "light" }), [{ paragraph: 1, afterSentence: 0, type: "pause", text: "Pause" }]);
});

test("the sentence closest to the key idea gets a pause after it", () => {
  const cues = cuesOf({
    paragraphs: ["We looked at three options for the pilot.", "A single focused month gives us a clear signal without a big commitment. After that we decide together."],
    keyIdea: "A focused one-month pilot gives a clear signal",
    density: "light",
  });
  assert.deepEqual(cues, [{ paragraph: 2, afterSentence: 1, type: "pause", text: "Pause" }]);
});

test("a sentence dense with figures is read slowly instead of bolded, never given a cue line", () => {
  const dense = "Plans start at $12 a month, or $99 a year for teams.";
  const { cues, marks } = place({ paragraphs: [`Pricing is simple. ${dense} Most people pick the yearly plan.`] });
  assert.deepEqual(marks, [{ paragraph: 1, sentence: 2, text: dense, mark: "slow" }]);
  assert.ok(cues.every((cue) => cue.type === "pause"));
});

test("filler with nothing worth marking gets nothing at light density", () => {
  assert.deepEqual(place({ paragraphs: ["This part is about how we work. We meet each week and review our tasks together."], density: "light" }), { cues: [], marks: [] });
});

test("marks become bold and slow runs in the document", () => {
  const dense = "Plans start at $12 a month, or $99 a year for teams.";
  const document = documentFromAi([`Pricing is simple. ${dense}`], [], [{ paragraph: 1, sentence: 2, text: dense, mark: "slow" }, { paragraph: 1, text: "$12", mark: "bold" }]);
  const runs = document.paragraphs[0].children;
  assert.deepEqual(runs.map((run) => run.type === "text" ? [run.text, Boolean(run.bold), Boolean(run.slow)] : []), [
    ["Pricing is simple. ", false, false],
    ["Plans start at ", false, true],
    ["$12", true, true],
    [" a month, or $99 a year for teams.", false, true],
  ]);
});

test("a mark formats its own sentence even when the words appear earlier in the paragraph", () => {
  const document = documentFromAi(["The keys expired once. Then they expired again, which broke the form."], [], [{ paragraph: 1, sentence: 2, text: "expired", mark: "bold" }]);
  assert.deepEqual(document.paragraphs[0].children.map((run) => run.type === "text" ? [run.text, Boolean(run.bold)] : []), [
    ["The keys expired once. Then they ", false],
    ["expired", true],
    [" again, which broke the form.", false],
  ]);
});

test("placement is identical on rerun and follows content rather than a fixed slot", () => {
  const slides = [
    { seed: "a", paragraphs: ["We started with a question from the sponsor. Could clients show where it hurts without medical terms?", "We built a clickable body map for that. It covers twelve familiar areas."] },
    { seed: "b", paragraphs: ["The build pipeline runs on every push, which caught regressions before review. That saved us a week.", "Our next step is automating the deployment. However, that needs credentials from the sponsor."] },
    { seed: "c", kind: "chart", paragraphs: ["This chart shows weekly active users. Usage doubled after the redesign.", "Most of that came from returning users."] },
  ];
  const placements = slides.map((slide) => cuesOf(slide));
  assert.deepEqual(placements, slides.map((slide) => cuesOf(slide)), "deterministic");
  const positions = new Set(placements.map((cues) => cues.map((cue) => `${cue.paragraph}:${cue.afterSentence}`).join(",")));
  assert.ok(positions.size > 1);
});

test("budget, spacing, and anchors hold on long varied scripts", () => {
  const sentences = [
    "Let me walk you through where we are.", "Why does this matter now?", "Signups rose 30% after launch.", "But retention stayed flat.",
    "The most important thing is that we learned why.", "You can see the drop on the chart at the right.", "People left after the second week, when reminders stopped, and nobody on the team noticed it for almost a month because we had no alerting in place at all.",
    "So we added reminders.", "Retention doubled.", "That's the result we want to protect.", "Next we test pricing.", "Thanks.",
  ];
  const paragraphs = [sentences.slice(0, 4).join(" "), sentences.slice(4, 8).join(" "), sentences.slice(8).join(" ")];
  const counts = paragraphs.map((paragraph) => splitSentences(paragraph).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  for (const density of ["light", "detailed"] as const) {
    for (const seed of ["x", "y", "z", "slide-9"]) {
      const { cues, marks } = placeDelivery({ paragraphs, density, seed, kind: "chart" });
      assert.ok(cues.length <= (density === "light" ? 1 : 4), `${density} cue budget`);
      assert.ok(marks.filter((mark) => mark.mark === "bold").length <= (density === "light" ? 1 : 2), `${density} bold budget`);
      const gaps = cues.map((cue) => counts.slice(0, cue.paragraph - 1).reduce((sum, count) => sum + count, 0) + cue.afterSentence);
      for (const gap of gaps) assert.ok(gap >= 0 && gap < total, "never after the last sentence");
      for (let index = 1; index < gaps.length; index += 1) assert.ok(gaps[index] - gaps[index - 1] >= 1, "at least one sentence between cues");
      for (const mark of marks) assert.ok(paragraphs[mark.paragraph - 1].includes(mark.text), "marks point at real text");
    }
  }
});
