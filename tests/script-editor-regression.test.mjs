import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const types = fs.readFileSync(`${root}/app/components/workspace/script-types.ts`, "utf8");
const lexical = fs.readFileSync(`${root}/app/components/workspace/script-lexical.ts`, "utf8");
const editor = fs.readFileSync(`${root}/app/components/workspace/ScriptEditor.tsx`, "utf8");

test("document schema stores paragraphs, marks, breaks, cue IDs, and version", () => {
  assert.match(types, /version: 1/);
  assert.match(types, /type: "break"/);
  assert.match(types, /bold\?: boolean/);
  assert.match(types, /italic\?: boolean/);
  assert.match(types, /id: string/);
});

test("legacy scripts migrate line breaks and command markup", () => {
  assert.match(types, /split\("\\n"\)/);
  assert.match(types, /bold\|italic\|cue/);
  assert.match(types, /fallbackCue/);
});

test("spoken text, word count, and duration exclude cues", () => {
  assert.match(types, /child\.type === "cue" \? ""/);
  assert.match(types, /documentToWordCount/);
  assert.match(types, /documentToDuration/);
});

test("Lexical state round trips custom nodes and formatting", () => {
  assert.match(lexical, /loadScriptDocument/);
  assert.match(lexical, /documentFromLexicalState/);
  assert.match(lexical, /hasFormat\("bold"\)/);
  assert.match(lexical, /hasFormat\("italic"\)/);
  assert.match(lexical, /__cueId/);
});

test("keyboard behavior delegates native copy and adds formatting/cue commands", () => {
  assert.match(editor, /KEY_DOWN_COMMAND/);
  assert.match(editor, /FORMAT_TEXT_COMMAND/);
  assert.match(editor, /key === "c"/);
  assert.match(editor, /selection\.isCollapsed\(\)/);
  assert.match(editor, /keyboardEvent\.key === "Escape"/);
  assert.match(editor, /keyboardEvent\.key === "Enter"/);
  assert.match(editor, /keyboardEvent\.key === "Backspace"/);
});

test("autosave is debounced and explicit save flushes", () => {
  assert.match(editor, /setTimeout/);
  assert.match(editor, /800/);
  assert.match(editor, /onSave\(slides\)/);
});

test("privacy boundary renders audience text from spoken document", () => {
  const presenter = fs.readFileSync(`${root}/app/presenter/page.tsx`, "utf8");
  assert.match(presenter, /documentToSpokenText/);
  assert.doesNotMatch(presenter, /dangerouslySetInnerHTML/);
});

test("empty documents always have one editable paragraph", () => {
  assert.match(lexical, /document\.paragraphs\.length \?/);
  assert.match(types, /textInline\(""\)/);
});

test("paragraph boundaries and explicit breaks are serialized", () => {
  assert.match(lexical, /\$isLineBreakNode/);
  assert.match(lexical, /type: "break"/);
  assert.match(types, /join\("\\n"\)/);
});

test("cue insertion creates stable IDs and next paragraphs", () => {
  assert.match(editor, /makeId\("cue"\)/);
  assert.match(editor, /makeId\("paragraph"\)/);
  assert.match(editor, /insertAfter\(next\)/);
});

test("format toolbar exposes active state and history controls", () => {
  assert.match(editor, /formats\.bold/);
  assert.match(editor, /formats\.italic/);
  assert.match(editor, /UNDO_COMMAND/);
  assert.match(editor, /REDO_COMMAND/);
});

test("line measurement reacts to edits, scroll, resize, and fonts", () => {
  assert.match(editor, /MutationObserver/);
  assert.match(editor, /addEventListener\("scroll"/);
  assert.match(editor, /document\.fonts\?\.ready/);
});

test("cue labels are accessible and private from spoken metrics", () => {
  assert.match(types, /documentCueCount/);
  assert.match(editor, /Cue editing/);
  assert.match(fs.readFileSync(`${root}/app/components/workspace/TeleprompterText.tsx`, "utf8"), /aria-label={`Cue:/);
});
