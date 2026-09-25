"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type BaseSelection,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { Bold, Eye, Hand, Italic, MessageSquarePlus, Pause, Redo2, Undo2, Wind } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { documentFromLexicalState, loadScriptDocument } from "@/lib/domain/script-lexical";
import { $createCueNode, CueNode, PARAGRAPH_REPLACEMENT, ScriptParagraphNode } from "@/lib/domain/script-nodes";
import { makeId, type ScriptDocument } from "@/lib/domain/script";
import type { SelectionAction } from "@/lib/ai/client";
import { IconButton } from "../ui/button";

export type ScriptSurfaceHandle = {
  insertCue: (label?: string) => void;
};

export const CUE_PRESETS = [
  { label: "Pause", icon: Pause },
  { label: "Look up", icon: Eye },
  { label: "Point to the slide", icon: Hand },
  { label: "Breathe", icon: Wind },
];

const SELECTION_ACTIONS: { action: SelectionAction; label: string }[] = [
  { action: "shorter", label: "Shorter" },
  { action: "simpler", label: "Simpler" },
  { action: "conversational", label: "More natural" },
  { action: "clearer", label: "Clearer" },
];

type Props = {
  document: ScriptDocument;
  onChange: (document: ScriptDocument) => void;
  locked: boolean;
  aiEnabled: boolean;
  onSelectionRewrite: (action: SelectionAction, text: string, apply: (replacement: string) => void) => void;
  toolbarEnd?: ReactNode;
  label: string;
  autoFocus?: boolean;
};

/**
 * The teleprompter script editor. Cues are atomic private nodes on their own line; formatting is
 * limited to what renders in Presenter (bold, italic). Remount with a new `key` to load new content.
 */
export const ScriptSurface = forwardRef<ScriptSurfaceHandle, Props>(function ScriptSurface({ document, onChange, locked, aiEnabled, onSelectionRewrite, toolbarEnd, label, autoFocus }, ref) {
  const config = useMemo(() => ({
    namespace: "CueframeScript",
    nodes: [ScriptParagraphNode, CueNode, PARAGRAPH_REPLACEMENT],
    theme: { paragraph: "script-paragraph", text: { bold: "script-bold", italic: "script-italic" } },
    onError: (error: Error) => { throw error; },
  }), []);
  const surfaceRef = useRef<HTMLDivElement>(null);

  return (
    <LexicalComposer initialConfig={config}>
      <Toolbar end={toolbarEnd} />
      <div className="script-surface" ref={surfaceRef} data-locked={locked}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="script-surface__input" aria-label={label} aria-multiline="true" spellCheck />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <Placeholder />
        <SelectionBubble containerRef={surfaceRef} aiEnabled={aiEnabled} locked={locked} onRewrite={onSelectionRewrite} />
      </div>
      <HistoryPlugin />
      {autoFocus && <AutoFocusPlugin defaultSelection="rootEnd" />}
      <DocumentPlugin document={document} onChange={onChange} />
      <EditablePlugin editable={!locked} />
      <KeyboardPlugin />
      <HandlePlugin ref={ref} />
    </LexicalComposer>
  );
});

// ── Cue insertion ───────────────────────────────────────────────────────────

/** Inserts a cue on its own line at the caret, replacing any selection (used as the cue label). */
function insertCue(editor: LexicalEditor, presetLabel?: string) {
  editor.focus();
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      const last = $getRoot().getLastChild();
      if (last instanceof ScriptParagraphNode) {
        last.selectEnd();
        selection = $getSelection();
      }
    }
    if (!$isRangeSelection(selection)) return;
    const selectedText = selection.isCollapsed() ? "" : selection.getTextContent().replace(/\s+/g, " ").trim();
    if (!selection.isCollapsed()) selection.removeText();
    const label = presetLabel ?? selectedText;
    // Lexical drops empty text nodes; a single space keeps an empty cue editable and is trimmed on save.
    const cue = $createCueNode(label || " ", makeId("cue"));
    const anchor = selection.anchor.getNode();
    const paragraph = anchor instanceof ScriptParagraphNode ? anchor : anchor.getParent();
    if (!(paragraph instanceof ScriptParagraphNode)) return;

    let splitIndex = selection.anchor.type === "element" ? selection.anchor.offset : anchor.getIndexWithinParent() + 1;
    if ($isTextNode(anchor) && !(anchor instanceof CueNode)) {
      const offset = selection.anchor.offset;
      if (offset === 0) splitIndex = anchor.getIndexWithinParent();
      else if (offset < anchor.getTextContentSize()) {
        const [, right] = anchor.splitText(offset);
        splitIndex = right.getIndexWithinParent();
      }
    }

    const trailing = paragraph.getChildren().slice(splitIndex);
    const cueParagraph = new ScriptParagraphNode(makeId("paragraph"));
    cueParagraph.append(cue);
    const nextParagraph = new ScriptParagraphNode(makeId("paragraph"));
    for (const node of trailing) nextParagraph.append(node);
    paragraph.insertAfter(cueParagraph);
    cueParagraph.insertAfter(nextParagraph);
    if (!paragraph.getChildrenSize()) paragraph.remove();
    if (label) nextParagraph.selectStart();
    else cue.select(cue.getTextContentSize(), cue.getTextContentSize());
  });
}

function cueAtSelection() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const node = selection.anchor.getNode();
  if (node instanceof CueNode) return node;
  const parent = node.getParent();
  return parent instanceof CueNode ? parent : null;
}

// ── Plugins ─────────────────────────────────────────────────────────────────

/** Lexical only shows its placeholder for built-in paragraphs; script paragraphs need their own. */
function Placeholder() {
  const [editor] = useLexicalComposerContext();
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    const check = (state: EditorState) => state.read(() => {
      const root = $getRoot();
      setEmpty(root.getChildrenSize() <= 1 && !root.getTextContent().trim());
    });
    check(editor.getEditorState());
    return editor.registerUpdateListener(({ editorState }) => check(editorState));
  }, [editor]);
  if (!empty) return null;
  return <div className="script-surface__placeholder" aria-hidden="true">Write what you&apos;ll say on this slide…</div>;
}

function Toolbar({ end }: { end?: ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState({ bold: false, italic: false });

  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) setFormats({ bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic") });
    });
  }), [editor]);

  const keep = (event: React.MouseEvent) => event.preventDefault();
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Script formatting and cues">
      <div className="editor-toolbar__group">
        <IconButton label="Bold (Ctrl+B)" size="sm" aria-pressed={formats.bold} onMouseDown={keep} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}><Bold /></IconButton>
        <IconButton label="Italic (Ctrl+I)" size="sm" aria-pressed={formats.italic} onMouseDown={keep} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}><Italic /></IconButton>
      </div>
      <span className="editor-toolbar__divider" aria-hidden="true" />
      <div className="editor-toolbar__group">
        <button type="button" className="cue-button" onMouseDown={keep} onClick={() => insertCue(editor)} data-tooltip="Add a private cue (Ctrl+K)">
          <MessageSquarePlus aria-hidden="true" /> Cue
        </button>
        {CUE_PRESETS.map(({ label, icon: Icon }) => (
          <IconButton key={label} label={`Add “${label}” cue`} size="sm" onMouseDown={keep} onClick={() => insertCue(editor, label)}><Icon /></IconButton>
        ))}
      </div>
      <span className="editor-toolbar__divider" aria-hidden="true" />
      <div className="editor-toolbar__group">
        <IconButton label="Undo (Ctrl+Z)" size="sm" onMouseDown={keep} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><Undo2 /></IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" size="sm" onMouseDown={keep} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><Redo2 /></IconButton>
      </div>
      {end && <div className="editor-toolbar__end">{end}</div>}
    </div>
  );
}

function DocumentPlugin({ document, onChange }: { document: ScriptDocument; onChange: (document: ScriptDocument) => void }) {
  const [editor] = useLexicalComposerContext();
  const initial = useRef(document);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    loadScriptDocument(editor, initial.current);
    // Loading is tagged, and selection-only updates dirty no nodes, so anything else is an edit.
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      if (tags.has("script-hydrate") || (!dirtyElements.size && !dirtyLeaves.size)) return;
      onChangeRef.current(documentFromLexicalState(editorState as EditorState));
    });
  }, [editor]);
  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => { editor.setEditable(editable); }, [editor, editable]);
  return null;
}

function KeyboardPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerCommand(KEY_DOWN_COMMAND, (event) => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.isComposing) return false;
    const modifier = keyboard.metaKey || keyboard.ctrlKey;
    const key = keyboard.key.toLowerCase();
    if (modifier && !keyboard.altKey && (key === "b" || key === "i")) {
      keyboard.preventDefault();
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, key === "b" ? "bold" : "italic");
      return true;
    }
    if (modifier && !keyboard.altKey && key === "k") {
      keyboard.preventDefault();
      insertCue(editor);
      return true;
    }
    if (keyboard.key !== "Enter" && keyboard.key !== "Escape" && keyboard.key !== "Backspace") return false;

    let handled = false;
    editor.update(() => {
      const cue = cueAtSelection();
      if (!cue) return;
      const empty = cue.getTextContent().trim().length === 0;
      if (keyboard.key === "Escape" || (keyboard.key === "Backspace" && empty) || (keyboard.key === "Enter" && empty)) {
        const paragraph = cue.getParent();
        cue.remove();
        if (paragraph instanceof ScriptParagraphNode && !paragraph.getChildrenSize()) {
          const previous = paragraph.getPreviousSibling();
          paragraph.remove();
          if (previous instanceof ScriptParagraphNode) previous.selectEnd();
        }
        handled = true;
        return;
      }
      if (keyboard.key === "Enter") {
        const paragraph = cue.getParent();
        if (paragraph) {
          let next = paragraph.getNextSibling();
          if (!(next instanceof ScriptParagraphNode) || next.getChildrenSize()) {
            next = new ScriptParagraphNode(makeId("paragraph"));
            paragraph.insertAfter(next);
          }
          (next as ScriptParagraphNode).selectStart();
        }
        handled = true;
      }
    });
    if (handled) keyboard.preventDefault();
    return handled;
  }, COMMAND_PRIORITY_LOW), [editor]);
  return null;
}

const HandlePlugin = forwardRef<ScriptSurfaceHandle>(function HandlePlugin(_, ref) {
  const [editor] = useLexicalComposerContext();
  useImperativeHandle(ref, () => ({ insertCue: (label?: string) => insertCue(editor, label) }), [editor]);
  return null;
});

/** Floating actions for selected text: targeted AI rewrites and "make this a cue". */
function SelectionBubble({ containerRef, aiEnabled, locked, onRewrite }: {
  containerRef: RefObject<HTMLDivElement | null>;
  aiEnabled: boolean;
  locked: boolean;
  onRewrite: Props["onSelectionRewrite"];
}) {
  const [editor] = useLexicalComposerContext();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const shown = useRef(false);
  useEffect(() => { shown.current = position !== null; }, [position]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const domSelection = window.getSelection();
    if (!container || !domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) return setPosition(null);
    const range = domSelection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return setPosition(null);
    const rect = range.getBoundingClientRect();
    const box = container.getBoundingClientRect();
    if (!rect.width && !rect.height) return setPosition(null);
    // The text scrolls inside its box; hide the bubble once the selection has scrolled out of view.
    const view = editor.getRootElement()?.getBoundingClientRect();
    if (view && (rect.bottom < view.top || rect.top > view.bottom)) return setPosition(null);
    setPosition({ top: rect.top - box.top - 8, left: Math.min(Math.max(rect.left - box.left + rect.width / 2, 150), box.width - 150) });
  }, [containerRef, editor]);

  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    let show = false;
    editorState.read(() => {
      const selection = $getSelection();
      show = $isRangeSelection(selection) && !selection.isCollapsed() && selection.getTextContent().trim().length > 1 && !cueAtSelection();
    });
    if (show) requestAnimationFrame(measure);
    else setPosition(null);
  }), [editor, measure]);

  useEffect(() => {
    const hide = () => setPosition(null);
    // Only a bubble that's already showing follows the text as it scrolls.
    const follow = () => { if (shown.current) measure(); };
    const root = editor.getRootElement();
    root?.addEventListener("blur", hide);
    root?.addEventListener("scroll", follow, { passive: true });
    return () => {
      root?.removeEventListener("blur", hide);
      root?.removeEventListener("scroll", follow);
    };
  }, [editor, measure]);

  if (!position || locked) return null;

  function rewrite(action: SelectionAction) {
    let saved: BaseSelection | null = null;
    let text = "";
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        saved = selection.clone();
        text = selection.getTextContent();
      }
    });
    if (!saved || !text.trim()) return;
    const snapshot: BaseSelection = saved;
    setPosition(null);
    onRewrite(action, text, (replacement) => {
      editor.setEditable(true);
      editor.update(() => {
        $setSelection(snapshot.clone());
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText(replacement);
      });
      editor.focus();
    });
  }

  return (
    <div className="selection-bubble" style={{ top: position.top, left: position.left }} role="toolbar" aria-label="Selected text" onMouseDown={(event) => event.preventDefault()}>
      {aiEnabled && SELECTION_ACTIONS.map(({ action, label }) => (
        <button key={action} type="button" onClick={() => rewrite(action)}>{label}</button>
      ))}
      {aiEnabled && <span className="selection-bubble__divider" aria-hidden="true" />}
      <button type="button" onClick={() => { setPosition(null); insertCue(editor); }}>Make cue</button>
    </div>
  );
}
