import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/components/workspace/script-types.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const scripts = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test("legacy scripts keep paragraphs and private cues", () => {
  const document = scripts.documentFromLegacy("First line\n[cue: Pause]\nSecond line");
  assert.equal(document.paragraphs.length, 3);
  assert.equal(scripts.documentCueCount(document), 1);
  assert.equal(scripts.documentToSpokenText(document), "First line\n\nSecond line");
  assert.equal(scripts.documentToWordCount(document), 4);
});

test("script formatting survives a serialized round trip", () => {
  const original = scripts.documentFromLegacy("/bold{Speak clearly} and /italic{slowly}");
  const restored = scripts.parseScriptDocument(JSON.stringify(original));
  assert.deepEqual(restored, original);
  assert.equal(scripts.documentToSpokenText(restored), "Speak clearly and slowly");
  assert.equal(scripts.documentToDuration(restored, 120), "0:02");
});

test("empty scripts remain editable", () => {
  const document = scripts.parseScriptDocument(undefined, "");
  assert.equal(document.paragraphs.length, 1);
  assert.equal(scripts.documentToWordCount(document), 0);
});

test("older bracket cues migrate out of spoken text", () => {
  const legacy = scripts.documentFromLegacy("Say this [pause] then look up [look up]");
  assert.equal(scripts.documentCueCount(legacy), 2);
  assert.equal(scripts.documentToSpokenText(legacy), "Say this  then look up ");
  const stored = { version: 1, paragraphs: [{ id: "p1", children: [{ type: "text", text: "Ready [emphasize] now" }] }] };
  assert.equal(scripts.documentCueCount(scripts.parseScriptDocument(stored)), 1);
});
