import {
  ElementNode,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedTextNode,
} from "lexical";

export type SerializedScriptParagraphNode = SerializedElementNode & { type: "script-paragraph"; paragraphId: string };
export type SerializedCueNode = SerializedTextNode & { type: "script-cue"; cueId: string };

export class ScriptParagraphNode extends ElementNode {
  __paragraphId: string;
  constructor(paragraphId: string, key?: NodeKey) { super(key); this.__paragraphId = paragraphId; }
  static getType() { return "script-paragraph"; }
  static clone(node: ScriptParagraphNode) { return new ScriptParagraphNode(node.__paragraphId, node.__key); }
  static importJSON(serialized: SerializedScriptParagraphNode) { return new ScriptParagraphNode(serialized.paragraphId); }
  exportJSON(): SerializedScriptParagraphNode { return { ...super.exportJSON(), type: "script-paragraph", paragraphId: this.__paragraphId, version: 1 }; }
  createDOM(config: EditorConfig) { const dom = document.createElement("div"); dom.className = config.theme.paragraph ?? "script-paragraph"; return dom; }
  updateDOM() { return false; }
}

export class CueNode extends TextNode {
  __cueId: string;
  constructor(label: string, cueId: string, key?: NodeKey) { super(label, key); this.__cueId = cueId; }
  static getType() { return "script-cue"; }
  static clone(node: CueNode) { return new CueNode(node.getTextContent(), node.__cueId, node.__key); }
  static importJSON(serialized: SerializedCueNode) { return new CueNode(serialized.text, serialized.cueId); }
  exportJSON(): SerializedCueNode { return { ...super.exportJSON(), type: "script-cue", cueId: this.__cueId, version: 1 }; }
  createDOM(config: EditorConfig) { const dom = super.createDOM(config); dom.className = "script-cue-chip"; dom.dataset.cueId = this.__cueId; dom.dataset.cueNode = "true"; dom.dataset.empty = this.getTextContent().trim() ? "false" : "true"; dom.setAttribute("aria-label", `Cue: ${this.getTextContent().trim() || "empty cue"}`); return dom; }
  updateDOM(prevNode: CueNode, dom: HTMLElement, config: EditorConfig) { const changed = super.updateDOM(prevNode as this, dom, config); dom.dataset.cueId = this.__cueId; dom.dataset.empty = this.getTextContent().trim() ? "false" : "true"; dom.setAttribute("aria-label", `Cue: ${this.getTextContent().trim() || "empty cue"}`); return changed; }
}

export function $createScriptParagraphNode(id: string) { return new ScriptParagraphNode(id); }
export function $isScriptParagraphNode(node: LexicalNode | null | undefined): node is ScriptParagraphNode { return node instanceof ScriptParagraphNode; }
export function $createCueNode(label: string, id: string) { return new CueNode(label, id); }
export function $isCueNode(node: LexicalNode | null | undefined): node is CueNode { return node instanceof CueNode; }
