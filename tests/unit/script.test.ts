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

test("AI prose becomes a plain document, one block per paragraph", () => {
  const document = documentFromAi(["Most launches compete for attention. Ours earns trust. Here's how.", "  First,  invite early users. ", ""]);
  assert.deepEqual(documentToParagraphs(document), ["Most launches compete for attention. Ours earns trust. Here's how.", "First, invite early users."]);
  assert.equal(documentCues(document).length, 0);
  assert.ok(document.paragraphs.every((paragraph) => paragraph.children.every((child) => child.type === "text" && !child.bold && !child.slow)));
  assert.equal(documentSentences(document).length, 4);
  assert.deepEqual(documentToParagraphs(documentFromAi([])), []);
});

test("plain-text export marks cues as bracketed notes", () => {
  const document = documentFromLegacy("Hello there.\n[cue: Smile]\nWelcome.");
  assert.equal(documentToPlainText(document), "Hello there.\n\n[Smile]\n\nWelcome.");
  assert.equal(documentToPlainText(document, { includeCues: false }), "Hello there.\n\nWelcome.");
});
