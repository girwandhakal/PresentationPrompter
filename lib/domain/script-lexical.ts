import {
  $createLineBreakNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type ElementNode,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import type { ScriptDocument, ScriptInline, ScriptParagraph } from "./script";
import { makeId } from "./script";
import { CueNode, ScriptParagraphNode, $createCueNode, $createScriptParagraphNode } from "./script-nodes";

/** Lexical has no custom text formats, so the unused highlight bit carries "read slowly". */
export const SLOW_FORMAT = "highlight";

export function loadScriptDocument(editor: LexicalEditor, document: ScriptDocument) {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    for (const paragraph of document.paragraphs.length ? document.paragraphs : [{ id: makeId("paragraph"), children: [{ type: "text", text: "" }] } as ScriptParagraph]) {
      const node = $createScriptParagraphNode(paragraph.id);
      for (const child of paragraph.children) {
        if (child.type === "cue") node.append($createCueNode(child.label, child.id));
        else if (child.type === "break") node.append($createLineBreakNode());
        else {
          const text = $createTextNode(child.text);
          if (child.bold) text.toggleFormat("bold");
          if (child.italic) text.toggleFormat("italic");
          if (child.slow) text.toggleFormat(SLOW_FORMAT);
          node.append(text);
        }
      }
      if (!node.getChildrenSize()) node.append($createTextNode(""));
      root.append(node);
    }
  }, { discrete: true, tag: "script-hydrate" });
}

function paragraphFromNode(node: ElementNode): ScriptParagraph {
  const children: ScriptInline[] = [];
  for (const child of node.getChildren()) {
    if (child.getType() === CueNode.getType() && child.getTextContent().trim()) {
      const cue = child as typeof child & { __cueId?: string };
      children.push({ type: "cue", id: cue.__cueId ?? `cue-${child.getKey()}`, label: child.getTextContent().trim() });
    }
    else if ($isLineBreakNode(child)) children.push({ type: "break" });
    else if ($isTextNode(child)) {
      const text = child.getTextContent();
      if (text || !children.length) children.push({ type: "text", text, ...(child.hasFormat("bold") ? { bold: true } : {}), ...(child.hasFormat("italic") ? { italic: true } : {}), ...(child.hasFormat(SLOW_FORMAT) ? { slow: true } : {}) });
    }
  }
  const id = node instanceof ScriptParagraphNode ? node.__paragraphId : makeId("paragraph");
  return { id, children: children.length ? children : [{ type: "text", text: "" }] };
}

export function documentFromLexicalState(editorState: EditorState): ScriptDocument {
  let result: ScriptDocument = { version: 1, paragraphs: [] };
  editorState.read(() => {
    // Any block under the root is kept, so text can never be dropped because of its node type.
    result = { version: 1, paragraphs: $getRoot().getChildren().filter($isElementNode).map(paragraphFromNode) };
  });
  if (!result.paragraphs.length) result.paragraphs.push({ id: makeId("paragraph"), children: [{ type: "text", text: "" }] });
  return result;
}
