import assert from "node:assert/strict";
import test from "node:test";
import {
  documentCueCount,
  documentCues,
  documentFromAi,
  documentFromLegacy,
  documentSentences,
  documentToDuration,
  documentToParagraphs,
  documentToPlainText,
  documentToSpokenText,
  documentToWordCount,
  parseScriptDocument,
  splitSentences,
} from "../../lib/domain/script";

test("legacy scripts keep paragraphs and private cues", () => {
  const document = documentFromLegacy("First line\n[cue: Pause]\nSecond line");
  assert.equal(document.paragraphs.length, 3);
  assert.equal(documentCueCount(document), 1);
  assert.equal(documentToSpokenText(document), "First line\n\nSecond line");
  assert.equal(documentToWordCount(document), 4);
});

test("formatting survives a serialized round trip", () => {
  const original = documentFromLegacy("/bold{Speak clearly} and /italic{slowly}");
  const restored = parseScriptDocument(JSON.stringify(original));
  assert.deepEqual(restored, original);
  assert.equal(documentToSpokenText(restored), "Speak clearly and slowly");
  assert.equal(documentToDuration(restored, 120), "0:02");
});

test("empty scripts remain editable", () => {
  const document = parseScriptDocument(undefined, "");
  assert.equal(document.paragraphs.length, 1);
  assert.equal(documentToWordCount(document), 0);
});

test("older bracket cues migrate out of spoken text", () => {
  const legacy = documentFromLegacy("Say this [pause] then look up [look up]");
  assert.equal(documentCueCount(legacy), 2);
  const stored = { version: 1, paragraphs: [{ id: "p1", children: [{ type: "text", text: "Ready [emphasize] now" }] }] };
  assert.equal(documentCueCount(parseScriptDocument(stored)), 1);
});

test("sentences split on terminal punctuation and keep it", () => {
  assert.deepEqual(splitSentences("One. Two? Three!  Four"), ["One.", "Two?", "Three!", "Four"]);
  assert.deepEqual(splitSentences("It rose to 74.5% (up from 61%). Then it held."), ["It rose to 74.5% (up from 61%).", "Then it held."]);
  assert.deepEqual(splitSentences("Use plain words, e.g. this one. “Quoted start.” Next."), ["Use plain words, e.g. this one.", "“Quoted start.”", "Next."]);
  assert.deepEqual(splitSentences(""), []);
});

test("AI prose becomes a document with cues on their own line after the anchored sentence", () => {
  const document = documentFromAi(
    ["Most launches compete for attention. Ours earns trust. Here's how.", "First, invite early users."],
    [
      { paragraph: 1, afterSentence: 2, label: "Pause here" },
      { paragraph: 2, afterSentence: 9, label: "Look up" },
    ],
  );
  const lines = document.paragraphs.map((paragraph) => paragraph.children.map((child) => child.type === "cue" ? `[${child.label}]` : child.type === "text" ? child.text : "").join(""));
  assert.deepEqual(lines, [
    "Most launches compete for attention. Ours earns trust.",
    "[Pause here]",
    "Here's how.",
    "First, invite early users.",
    "[Look up]",
  ]);
  assert.equal(documentCues(document).length, 2);
  assert.deepEqual(documentToParagraphs(document), ["Most launches compete for attention. Ours earns trust.", "Here's how.", "First, invite early users."]);
  assert.equal(documentSentences(document).length, 4);
});

test("cues with out-of-range anchors are clamped rather than dropped", () => {
  const document = documentFromAi(["Only sentence."], [{ paragraph: 7, afterSentence: 0, label: "Breathe" }]);
  assert.equal(documentCueCount(document), 1);
  assert.equal(documentToWordCount(document), 2);
});

test("a cue anchored after sentence 0 opens its paragraph", () => {
  const document = documentFromAi(["First point. Second point."], [{ paragraph: 1, afterSentence: 0, label: "Let them read the chart" }]);
  assert.equal(documentToPlainText(document), "[Let them read the chart]\n\nFirst point. Second point.");
});

test("plain-text export marks cues as bracketed notes", () => {
  const document = documentFromAi(["Hello there. Welcome."], [{ paragraph: 1, afterSentence: 1, label: "Smile" }]);
  assert.equal(documentToPlainText(document), "Hello there.\n\n[Smile]\n\nWelcome.");
  assert.equal(documentToPlainText(document, { includeCues: false }), "Hello there.\n\nWelcome.");
});
