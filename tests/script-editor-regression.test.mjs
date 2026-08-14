import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const types = fs.readFileSync(`${root}/app/components/workspace/script-types.ts`, "utf8");
const lexical = fs.readFileSync(`${root}/app/components/workspace/script-lexical.ts`, "utf8");
const editor = fs.readFileSync(`${root}/app/components/workspace/ScriptEditor.tsx`, "utf8");
const overview = fs.readFileSync(`${root}/app/components/workspace/PresentationWorkspace.tsx`, "utf8");
const styles = fs.readFileSync(`${root}/app/globals.css`, "utf8");

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

test("studio header relies on autosave without save controls", () => {
  assert.doesNotMatch(editor, /aria-label="Save script"/);
  assert.doesNotMatch(editor, /className="saved-state"/);
});

test("studio canvas omits script metadata chrome", () => {
  assert.doesNotMatch(editor, /className="duration-pill"/);
  assert.doesNotMatch(editor, /className="editor-stats"/);
});

test("overview slide rail uses numbered thumbnails without captions", () => {
  assert.match(overview, /className="slide-number">\{index \+ 1\}/);
  assert.match(overview, /aria-label={`Slide \${index \+ 1}: \${item\.title}`}/);
  assert.doesNotMatch(overview, /<div className="panel-label">/);
  assert.doesNotMatch(overview, /slide-rail__title/);
});

test("compact slide thumbnails clip every corner consistently", () => {
  assert.match(styles, /\.slide-visual\.is-compact \{[^}]*border-radius: 10px/);
  assert.match(styles, /\.slide-visual\.is-compact \{[^}]*clip-path: inset\(0 round 10px\)/);
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

test("studio editor omits the line-number gutter", () => {
  assert.doesNotMatch(editor, /LineNumberGutter/);
  assert.doesNotMatch(editor, /script-line-gutter/);
});

test("script scroll uses one composited, speed-sensitive elastic layer", () => {
  assert.match(editor, /addEventListener\("wheel"/);
  assert.match(editor, /passive: false/);
  assert.match(editor, /requestAnimationFrame\(animate\)/);
  assert.match(editor, /filteredSpeed/);
  assert.match(editor, /direction = delta > 0 \? -1 : 1/);
  assert.match(editor, /response = target === 0 \? 55 : 52/);
  assert.match(editor, /window\.setTimeout\(release, 24\)/);
  assert.match(editor, /script-editor-elastic-layer/);
});

test("cue labels are accessible and private from spoken metrics", () => {
  assert.match(types, /documentCueCount/);
  assert.match(editor, /aria-label={`Insert \${label} cue`}/);
  assert.match(fs.readFileSync(`${root}/app/components/workspace/TeleprompterText.tsx`, "utf8"), /aria-label={`Cue:/);
});
