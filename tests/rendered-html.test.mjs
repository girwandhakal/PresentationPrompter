import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const editor = fs.readFileSync(`${root}/app/components/workspace/ScriptEditor.tsx`, "utf8");
const nodes = fs.readFileSync(`${root}/app/components/workspace/script-nodes.ts`, "utf8");
const preview = fs.readFileSync(`${root}/app/components/workspace/TeleprompterText.tsx`, "utf8");
const css = fs.readFileSync(`${root}/app/globals.css`, "utf8");

test("rich editor uses Lexical and one accessible contenteditable", () => {
  assert.match(editor, /LexicalComposer/);
  assert.match(editor, /ContentEditable aria-label="Script editor"/);
  assert.doesNotMatch(editor, /document\.execCommand/);
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML/);
});

test("gutter measures wrapped DOM rows and reflows after layout changes", () => {
  assert.match(editor, /Range\(\)/);
  assert.match(editor, /getClientRects/);
  assert.match(editor, /ResizeObserver/);
  assert.match(editor, /requestAnimationFrame/);
  assert.match(editor, /aria-hidden="true"/);
});

test("script nodes persist stable paragraph and cue IDs", () => {
  assert.match(nodes, /paragraphId/);
  assert.match(nodes, /cueId/);
  assert.match(nodes, /exportJSON/);
  assert.match(nodes, /aria-label/);
});

test("preview renders structured text without raw markup injection", () => {
  assert.match(preview, /<strong>/);
  assert.match(preview, /<em>/);
  assert.doesNotMatch(preview, /dangerouslySetInnerHTML/);
  assert.match(preview, /teleprompter-cue/);
});

test("editor visual conventions include a noninteractive placeholder and bold cue chips", () => {
  assert.match(css, /script-editor-placeholder/);
  assert.match(css, /\.script-editor-placeholder \{[^}]*pointer-events: none/);
  assert.match(css, /script-cue-chip/);
  assert.match(css, /font-weight: 750/);
});
