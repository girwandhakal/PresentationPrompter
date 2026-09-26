import assert from "node:assert/strict";
import test from "node:test";
import { placeCues, type CueContext } from "../../lib/domain/cues";
import { splitSentences } from "../../lib/domain/script";

const at = (context: Partial<CueContext> & Pick<CueContext, "paragraphs">) => placeCues({ density: "detailed", seed: "slide-1", ...context });

test("no cues when density is none or the script is empty", () => {
  assert.deepEqual(at({ paragraphs: ["Activation rose to 74%. Here's why."], density: "none" }), []);
  assert.deepEqual(at({ paragraphs: [] }), []);
  assert.deepEqual(at({ paragraphs: ["   "] }), []);
});

test("a key figure gets an emphasis cue right before the sentence that says it", () => {
  const cues = at({ paragraphs: ["We simplified the signup form. Completion went from 40% to 65% in a month. That held for every region."], density: "light" });
  assert.deepEqual(cues, [{ paragraph: 1, afterSentence: 1, type: "emphasis", text: "Stress 40%" }]);
});

test("ticket numbers are not treated as figures", () => {
  const cues = at({ paragraphs: ["We merged the fix in #42 and #45. The form sends again. Next we clean up the backlog."], density: "light" });
  assert.ok(cues.every((cue) => cue.type !== "emphasis"));
});

test("a question gets room after it, never after the final sentence", () => {
  const cues = at({ paragraphs: ["So why did the form stop sending? The credentials had expired. We swapped in test ones to keep going."], density: "light" });
  assert.deepEqual(cues, [{ paragraph: 1, afterSentence: 1, type: "pause", text: cues[0].text }]);
  assert.deepEqual(at({ paragraphs: ["We covered a lot today. Any questions?"], density: "light" }).filter((cue) => cue.type === "pause"), []);
});

test("chart slides open by letting the audience read the chart", () => {
  const cues = at({ paragraphs: ["Revenue grew steadily through the year. The spring dip was a pricing test."], kind: "chart", density: "light" });
  assert.deepEqual(cues, [{ paragraph: 1, afterSentence: 0, type: "look", text: cues[0].text }]);
});

test("naming a pointable element produces a gesture cue before that sentence", () => {
  const cues = at({
    paragraphs: ["Here is how the team split the work. Most of the effort went into the body map viewer, which drives everything else. The rest was testing."],
    elements: [{ label: "Body map viewer" }],
    density: "light",
  });
  assert.deepEqual(cues, [{ paragraph: 1, afterSentence: 1, type: "gesture", text: "Point to Body map viewer" }]);
});

test("the sentence closest to the key idea gets a pause after it", () => {
  const cues = at({
    paragraphs: ["We looked at three options for the pilot.", "A single focused month gives us a clear signal without a big commitment. After that we decide together."],
    keyIdea: "A focused one-month pilot gives a clear signal",
    density: "light",
  });
  assert.deepEqual(cues, [{ paragraph: 2, afterSentence: 1, type: "pause", text: cues[0].text }]);
});

test("filler with nothing worth marking gets no cue at light density", () => {
  assert.deepEqual(at({ paragraphs: ["This part is about how we work. We meet each week and review our tasks together."], density: "light" }), []);
});

test("placement is identical on rerun and differs from slide to slide", () => {
  const slides = [
    { seed: "a", paragraphs: ["We started with a question from the sponsor. Could clients show where it hurts without medical terms?", "We built a clickable body map for that. It covers twelve familiar areas."] },
    { seed: "b", paragraphs: ["The build pipeline now runs on every push. That caught three regressions before review.", "But the deployment still needs manual steps. We want that automated next."] },
    { seed: "c", kind: "chart", paragraphs: ["This chart shows weekly active users. Usage doubled after the redesign.", "Most of that came from returning users."] },
  ];
  const placements = slides.map((slide) => at(slide));
  assert.deepEqual(placements, slides.map((slide) => at(slide)), "deterministic");
  const positions = new Set(placements.map((cues) => cues.map((cue) => `${cue.paragraph}:${cue.afterSentence}`).join(",")));
  assert.ok(positions.size > 1, "placement follows content, not a fixed slot");
});

test("budget, spacing, and anchors hold on long varied scripts", () => {
  const sentences = [
    "Let me walk you through where we are.", "Why does this matter now?", "Signups rose 30% after launch.", "But retention stayed flat.",
    "The most important thing is that we learned why.", "You can see the drop on the chart at the right.", "People left after the second week, when reminders stopped, and nobody on the team noticed it for almost a month because we had no alerting in place at all.",
    "So we added reminders.", "Retention doubled.", "That's the result we want to protect.", "Next we test pricing.", "Thanks.",
  ];
  const paragraphs = [sentences.slice(0, 4).join(" "), sentences.slice(4, 8).join(" "), sentences.slice(8).join(" ")];
  for (const density of ["light", "detailed"] as const) {
    for (const seed of ["x", "y", "z", "slide-9"]) {
      const cues = placeCues({ paragraphs, density, seed, kind: "chart" });
      const words = paragraphs.join(" ").split(/\s+/).length;
      assert.ok(cues.length <= (density === "light" ? (words >= 160 ? 2 : 1) : 4), `${density} budget`);
      const counts = paragraphs.map((paragraph) => splitSentences(paragraph).length);
      const gaps = cues.map((cue) => counts.slice(0, cue.paragraph - 1).reduce((sum, count) => sum + count, 0) + cue.afterSentence);
      const total = counts.reduce((sum, count) => sum + count, 0);
      for (const gap of gaps) assert.ok(gap >= 0 && gap < total, "never after the last sentence");
      for (let index = 1; index < gaps.length; index += 1) assert.ok(gaps[index] - gaps[index - 1] >= 2, "at least one sentence between cues");
      assert.ok(cues.every((cue) => cue.text.split(/\s+/).length <= 6));
    }
  }
});
