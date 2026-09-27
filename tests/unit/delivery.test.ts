import assert from "node:assert/strict";
import test from "node:test";
import { applySentenceNotes, placeDelivery, type DeliveryContext, type SentenceNotes } from "../../lib/domain/cues";
import { deliverSlides, voteSentenceNotes } from "../../lib/ai/server/delivery";
import { deliveryText } from "../../lib/ai/server/prompts";
import type { AiProvider } from "../../lib/ai/server/provider";
import type { DeliveryOutput, DeliveryRequest } from "../../lib/ai/schemas";

const context: DeliveryContext = {
  paragraphs: [
    "So why did the form stop sending? Our EmailJS credentials had expired.",
    "But you can see on the chart that submissions recovered to 96% within a day. We now check the keys every week.",
  ],
  density: "detailed",
  seed: "s7",
  title: "Form submission error",
  kind: "content",
};

const note = (values: Partial<SentenceNotes> = {}): SentenceNotes => ({ asksAudience: 0, statesMainPoint: 0, turnsArgument: 0, mustCatchExactly: 0, stress: "", ...values });

test("agreed facts become cues and marks by fixed rules", () => {
  const result = applySentenceNotes(context, [
    note({ asksAudience: 1 }),
    note({ statesMainPoint: 1, stress: "expired" }),
    note({ turnsArgument: 1, stress: "96%" }),
    note(),
  ]);
  assert.deepEqual(result.cues, [
    { paragraph: 1, afterSentence: 1, type: "pause", text: "Pause" },
    { paragraph: 1, afterSentence: 2, type: "pause", text: "Pause" },
  ], "question and main point get pauses; the turn falls in the same gap as the main point");
  assert.deepEqual(result.marks, [
    { paragraph: 1, sentence: 2, text: "expired", mark: "bold" },
    { paragraph: 2, sentence: 1, text: "96%", mark: "bold" },
  ]);
});

test("stress words must be whole words in their sentence", () => {
  const quarter: DeliveryContext = { ...context, paragraphs: ["We plan for Q3 and ship in 3 weeks."] };
  assert.deepEqual(applySentenceNotes(quarter, [note({ stress: "3" })]).marks, [{ paragraph: 1, sentence: 1, text: "3", mark: "bold" }]);
  const document = applySentenceNotes({ ...context, paragraphs: ["Q3 planning starts now."] }, [note({ stress: "3" })]);
  assert.deepEqual(document.marks, []);
});

test("a fact only counts with majority agreement, and slow and stress need every read", () => {
  const result = applySentenceNotes(context, [
    note({ asksAudience: 1 / 3 }),
    note({ mustCatchExactly: 2 / 3 }),
    note({ turnsArgument: 2 / 3 }),
    note(),
  ]);
  assert.deepEqual(result.cues, [{ paragraph: 1, afterSentence: 2, type: "pause", text: "Pause" }]);
  assert.deepEqual(result.marks, []);
});

test("bold is kept for the slide's point, figures, and contrasts, and must be quoted exactly", () => {
  const result = applySentenceNotes(context, [
    note({ stress: "form" }),
    note({ stress: "had expired" }),
    note({ stress: "ninety-six percent" }),
    note({ stress: "every week" }),
  ]);
  assert.deepEqual(result.marks, [{ paragraph: 2, sentence: 2, text: "every week", mark: "bold" }]);
});

test("notes that don't match the script fall back to rules", () => {
  assert.deepEqual(applySentenceNotes(context, [note()]), placeDelivery(context));
});

type Read = DeliveryOutput["slides"][number]["sentences"][number];
const read = (answers: Partial<Read>[]) => ({ id: "s7", sentences: answers.map((answer, index) => ({ n: index + 1, asksAudience: false, statesMainPoint: false, turnsArgument: false, mustCatchExactly: false, stress: "", ...answer })) });

test("votes turn reads into agreement shares, and stress needs every read to pick the same words", () => {
  const notes = voteSentenceNotes([
    read([{ asksAudience: true, stress: "96%" }, { stress: "never" }]),
    read([{ asksAudience: true, stress: "96%" }, { stress: "Never." }]),
    read([{ asksAudience: false, stress: "recovered" }, { stress: "never" }]),
  ], 2)!;
  assert.equal(notes[0].asksAudience, 2 / 3);
  assert.equal(notes[0].stress, "");
  assert.equal(notes[1].stress, "never");
  assert.equal(voteSentenceNotes([read([{}])], 2), null, "a read with the wrong sentence count is ignored");
  assert.equal(voteSentenceNotes([read([{ asksAudience: true }, {}])], 2, 3), null, "one surviving read of three is not a vote");
  assert.ok(voteSentenceNotes([read([{}, {}]), read([{}, {}])], 2, 3), "two of three is");
});

test("the coach sees numbered sentences and paragraph breaks", () => {
  const text = deliveryText({ slides: [{ id: "s7", title: "T", kind: "chart", keyIdea: "Keys expired", sentences: ["One.", "Two.", "Three."], paragraphStarts: [1, 3] }] });
  assert.match(text, /\[1\] One\.\n\[2\] Two\.\n\n\[3\] Three\./);
  assert.match(text, /Main point: Keys expired/);
});

function provider(delivery?: (request: DeliveryRequest) => Promise<DeliveryOutput>) {
  return { delivery } as unknown as AiProvider;
}

test("the delivery pass votes over parallel reads, and uses rules when the coach can't answer", async () => {
  const signal = new AbortController().signal;
  const second = { ...context, seed: "s8" };
  let calls = 0;
  const coached = await deliverSlides(provider(async (request) => {
    calls += 1;
    assert.equal(request.slides.length, 2);
    return { slides: [read([{ asksAudience: true }, {}, {}, {}])] };
  }), [context, second], signal);
  assert.equal(calls, 3, "three independent reads");
  assert.deepEqual(coached[0].cues, [{ paragraph: 1, afterSentence: 1, type: "pause", text: "Pause" }]);
  assert.deepEqual(coached[1], placeDelivery(second), "a slide no read covered falls back to rules");

  const quiet = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await deliverSlides(provider(async () => { throw new Error("rate limited"); }), [context], signal), [placeDelivery(context)]);
  } finally {
    console.error = quiet;
  }
  assert.deepEqual(await deliverSlides(provider(), [context], signal), [placeDelivery(context)]);

  let called = false;
  await deliverSlides(provider(async () => { called = true; return { slides: [] }; }), [{ ...context, density: "none" }], signal);
  assert.equal(called, false, "no request when cues are off");
});
