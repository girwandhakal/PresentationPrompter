"use client";

import { ArrowLeft, Bold, Clock3, Eye, Italic, Maximize2, Menu, Mic2, Redo2, Save, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { SlideVisual } from "./SlideVisual";
import { TeleprompterText } from "./TeleprompterText";
import type { Presentation, Slide } from "./types";
import { CueNode, ScriptParagraphNode, $createCueNode } from "./script-nodes";
import { documentFromLexicalState, loadScriptDocument } from "./script-lexical";
import {
  documentCueCount,
  documentFromLegacy,
  documentToDuration,
  documentToSpokenText,
  documentToWordCount,
  makeId,
  parseScriptDocument,
  type ScriptDocument,
} from "./script-types";

type Props = {
  presentation: Presentation;
  onBack: () => void;
  onSave: (slides: Slide[]) => void;
  onOpenSidebar: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const cuePresets = [
  { label: "Pause", icon: Clock3 },
  { label: "Look up", icon: Eye },
  { label: "Gesture", icon: Sparkles },
  { label: "Breathe", icon: Mic2 },
];

function ToolbarPlugin({ onCue }: { onCue: (editor: LexicalEditor, label?: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState({ bold: false, italic: false });

  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        setFormats({ bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic") });
      }
    });
  }), [editor]);

  function format(name: "bold" | "italic") {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, name);
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Script formatting and cues">
      <div className="toolbar-group" aria-label="Text formatting">
        <button type="button" className={formats.bold ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} aria-label="Toggle bold" aria-pressed={formats.bold} title="Toggle bold (Ctrl/Cmd+B)"><Bold /></button>
        <button type="button" className={formats.italic ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} aria-label="Toggle italic" aria-pressed={formats.italic} title="Toggle italic (Ctrl/Cmd+I)"><Italic /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onCue(editor)} aria-label="Insert cue" title="Insert a private cue"><Sparkles /><span>Make cue</span></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} aria-label="Undo" title="Undo"><Undo2 /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} aria-label="Redo" title="Redo"><Redo2 /></button>
      </div>
      <div className="toolbar-divider" aria-hidden="true" />
      <div className="toolbar-group toolbar-group--cues" aria-label="Cue presets">
        {cuePresets.map(({ label, icon: Icon }) => (
          <button type="button" key={label} onMouseDown={(event) => event.preventDefault()} onClick={() => onCue(editor, label)} aria-label={`Insert ${label} cue`} title={`Insert ${label} cue`}><Icon /><span>{label}</span></button>
        ))}
      </div>
    </div>
  );
}

function cueFromSelection() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const node = selection.anchor.getNode();
  if (node instanceof CueNode) return node;
  const parent = node.getParent();
  return parent instanceof CueNode ? parent : null;
}

function CueKeyboardPlugin({ startCue, onCueState }: { startCue: (editor: LexicalEditor) => void; onCueState: (value: boolean) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => editor.registerCommand(KEY_DOWN_COMMAND, (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.isComposing) return false;

    const modifier = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
    const key = keyboardEvent.key.toLowerCase();
    if (modifier && !keyboardEvent.altKey && key === "b") {
      keyboardEvent.preventDefault();
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
      return true;
    }
    if (modifier && !keyboardEvent.altKey && key === "i") {
      keyboardEvent.preventDefault();
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
      return true;
    }
    if (modifier && !keyboardEvent.altKey && key === "c") {
      let collapsed = false;
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        collapsed = $isRangeSelection(selection) && selection.isCollapsed();
      });
      if (!collapsed) return false;
      keyboardEvent.preventDefault();
      startCue(editor);
      return true;
    }

    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== "Escape" && keyboardEvent.key !== "Backspace") return false;

    let handled = false;
    editor.update(() => {
      const cue = cueFromSelection();
      if (!cue) return;
      const empty = cue.getTextContent().trim().length === 0;
      if (keyboardEvent.key === "Escape" || (keyboardEvent.key === "Backspace" && empty)) {
        cue.remove();
        onCueState(false);
        handled = true;
        return;
      }
      if (keyboardEvent.key === "Enter") {
        if (empty) {
          cue.remove();
          onCueState(false);
          handled = true;
          return;
        }
        const paragraph = cue.getParent();
        if (paragraph) {
          const next = new ScriptParagraphNode(makeId("paragraph"));
          next.append($createTextNode(""));
          paragraph.insertAfter(next);
          next.selectStart();
        }
        onCueState(false);
        handled = true;
      }
    });
    if (handled) {
      keyboardEvent.preventDefault();
      return true;
    }
    return false;
  }, COMMAND_PRIORITY_LOW), [editor, onCueState, startCue]);

  return null;
}

function LineNumberGutter({
  editorRef,
  scrollRef,
  gutterRef,
  onCount,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  gutterRef: React.RefObject<HTMLDivElement | null>;
  onCount: (count: number) => void;
}) {
  const redraw = useCallback(() => {
    const editor = editorRef.current;
    const scroll = scrollRef.current;
    const gutter = gutterRef.current;
    if (!editor || !scroll || !gutter) return;

    const rects: DOMRect[] = [];
    editor.querySelectorAll<HTMLElement>(".script-paragraph").forEach((paragraph) => {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;
      let hasVisibleText = false;
      while ((textNode = walker.nextNode())) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.height > 0 && rect.width >= 0) {
            rects.push(rect);
            hasVisibleText = true;
          }
        }
      }
      paragraph.querySelectorAll("br").forEach((breakNode) => {
        const range = document.createRange();
        range.selectNode(breakNode);
        const rect = range.getBoundingClientRect();
        if (rect.height > 0) rects.push(rect);
      });
      if (!hasVisibleText && !paragraph.querySelector("br")) rects.push(paragraph.getBoundingClientRect());
    });

    const editorTop = editor.getBoundingClientRect().top;
    const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 25;
    const mergeDistance = Math.max(2, lineHeight * 0.18);
    const rows = rects
      .filter((rect) => rect.height > 0)
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .reduce<number[]>((positions, rect) => {
        const y = rect.top - editorTop + scroll.scrollTop;
        if (!positions.length || Math.abs(positions[positions.length - 1] - y) > mergeDistance) positions.push(y);
        return positions;
      }, []);

    gutter.replaceChildren(...rows.map((y, index) => {
      const line = document.createElement("span");
      line.className = "script-line-number";
      line.textContent = String(index + 1);
      line.style.top = `${y}px`;
      return line;
    }));
    gutter.style.height = `${Math.max(editor.scrollHeight, scroll.clientHeight)}px`;
    onCount(rows.length);
  }, [editorRef, gutterRef, onCount, scrollRef]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(redraw);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const editor = editorRef.current;
    const scroll = scrollRef.current;
    if (editor) resizeObserver.observe(editor);
    if (scroll) resizeObserver.observe(scroll);
    const mutationObserver = editor ? new MutationObserver(schedule) : null;
    mutationObserver?.observe(editor, { subtree: true, childList: true, characterData: true });
    scroll?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
      scroll?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [editorRef, redraw, scrollRef]);

  return null;
}

function EditorDocumentPlugin({ document, onChange }: { document: ScriptDocument; onChange: (state: EditorState) => void }) {
  const [editor] = useLexicalComposerContext();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadScriptDocument(editor, document);
    const hydratedState = JSON.stringify(editor.getEditorState().toJSON());
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (JSON.stringify(editorState.toJSON()) !== hydratedState) onChange(editorState);
    });
    return unregister;
  }, [document, editor, onChange]);

  return null;
}

export function ScriptEditor({ presentation, onBack, onSave, onOpenSidebar, onDirtyChange }: Props) {
  const [slides, setSlides] = useState(() => presentation.slides.map((slide) => ({
    ...slide,
    script: slide.script ?? parseScriptDocument(undefined, slide.body, slide.cue),
  })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [saved, setSaved] = useState(true);
  const [pendingCue, setPendingCue] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const autosave = useRef<number | undefined>(undefined);
  const active = slides[activeIndex];

  useEffect(() => onDirtyChange?.(!saved), [onDirtyChange, saved]);

  const updateScript = useCallback((state: EditorState) => {
    const script = documentFromLexicalState(state);
    setSlides((current) => current.map((slide) => slide.id === active?.id
      ? { ...slide, script, body: documentToSpokenText(script), duration: documentToDuration(script) }
      : slide));
    setSaved(false);
  }, [active?.id]);

  const startCue = useCallback((editor: LexicalEditor, label = "") => {
    let inserted = false;
    editor.focus();
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        const lastParagraph = $getRoot().getLastChild();
        if (lastParagraph instanceof ScriptParagraphNode) {
          lastParagraph.selectEnd();
          selection = $getSelection();
        }
      }
      if (!$isRangeSelection(selection)) return;
      // Lexical drops zero-length TextNodes. A single whitespace sentinel keeps
      // an empty cue visible while trim-based serialization still excludes it.
      const cue = $createCueNode(label || " ", makeId("cue"));
      const currentNode = selection.anchor.getNode();
      const currentParagraph = currentNode instanceof ScriptParagraphNode ? currentNode : currentNode.getParent();
      if (currentNode instanceof CueNode) currentNode.insertAfter(cue);
      else if (currentParagraph instanceof ScriptParagraphNode && currentNode !== currentParagraph) selection.insertNodes([cue]);
      else if (currentParagraph instanceof ScriptParagraphNode) currentParagraph.append(cue);
      else {
        const fallbackParagraph = $getRoot().getLastChild();
        if (fallbackParagraph instanceof ScriptParagraphNode) fallbackParagraph.append(cue);
        else return;
      }
      const offset = cue.getTextContent().length;
      cue.select(offset, offset);
      inserted = true;
    });
    if (inserted) setPendingCue(true);
  }, []);

  const save = useCallback(() => {
    if (autosave.current) window.clearTimeout(autosave.current);
    onSave(slides);
    setSaved(true);
  }, [onSave, slides]);

  const setActiveSlide = useCallback((index: number) => {
    if (index === activeIndex) return;
    if (!saved) save();
    setPendingCue(false);
    setLineCount(0);
    setActiveIndex(index);
  }, [activeIndex, save, saved]);

  useEffect(() => {
    if (saved) return;
    if (autosave.current) window.clearTimeout(autosave.current);
    autosave.current = window.setTimeout(() => {
      onSave(slides);
      setSaved(true);
    }, 800);
    return () => {
      if (autosave.current) window.clearTimeout(autosave.current);
    };
  }, [onSave, saved, slides]);

  const config = useMemo(() => ({
    namespace: "CueframeScript",
    nodes: [ScriptParagraphNode, CueNode],
    theme: { paragraph: "script-paragraph", text: { bold: "script-bold", italic: "script-italic" } },
    onError: (error: Error) => { throw error; },
  }), []);

  if (!active) return null;
  const script = active.script ?? documentFromLegacy(active.body, active.cue);
  const words = documentToWordCount(script);
  const cues = documentCueCount(script);

  function leave() {
    if (!saved) save();
    onBack();
  }

  return (
    <main className="editor-workspace">
      <header className="editor-header">
        <div className="editor-header__left">
          <button type="button" className="icon-button mobile-menu" onClick={onOpenSidebar} aria-label="Open presentation sidebar"><Menu /></button>
          <button type="button" className="back-button" onClick={leave} aria-label="Back to presentation"><ArrowLeft /></button>
          <strong>{presentation.title}</strong>
        </div>
        <div className="editor-header__tools">
          <span className="saved-state" aria-label={saved ? "Saved" : "Unsaved changes"}><i className={saved ? "" : "is-unsaved"} /></span>
          <button type="button" className="header-icon header-icon--primary" onClick={save} aria-label="Save script"><Save /></button>
        </div>
      </header>

      <div className="editor-layout">
        <section className="editor-slide-list glass-panel" aria-label="Presentation slides">
          <div className="panel-label"><span className="sr-only">Slides</span><small>{slides.length}</small></div>
          {slides.map((slide, index) => (
            <button type="button" className={activeIndex === index ? "is-active" : ""} onClick={() => setActiveSlide(index)} key={slide.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{slide.title}</strong><small>{slide.duration} · {slide.marker}</small></div>
            </button>
          ))}
        </section>

        <section className="editor-canvas glass-panel">
          <div className="editor-canvas__top">
            <div><span className="eyebrow">Script · slide {activeIndex + 1}</span><h1>{active.title}</h1></div>
            <div className="duration-pill"><Clock3 /> {active.duration}</div>
          </div>

          <LexicalComposer initialConfig={config} key={active.id}>
            <ToolbarPlugin onCue={startCue} />
            <EditorDocumentPlugin document={script} onChange={updateScript} />
            <CueKeyboardPlugin startCue={startCue} onCueState={setPendingCue} />
            <HistoryPlugin />
            <div className="script-editor-surface" aria-label="Spoken script editing surface">
              <div className="script-editor-scroll" ref={scrollRef}>
                <div className="script-line-gutter" ref={gutterRef} aria-hidden="true" />
                <RichTextPlugin
                  contentEditable={<div ref={editorRef} className="script-editor-input"><ContentEditable aria-label="Script editor" /></div>}
                  placeholder={<div className="script-editor-placeholder">Start writing your script…</div>}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <LineNumberGutter editorRef={editorRef} scrollRef={scrollRef} gutterRef={gutterRef} onCount={setLineCount} />
              </div>
            </div>
          </LexicalComposer>

          <div className="editor-stats" aria-live="polite">
            <span>{words} words</span><span>{lineCount || script.paragraphs.length} lines</span><span>{cues} cues</span>
            {pendingCue && <span className="cue-editing">Cue editing · Enter to commit · Esc to cancel</span>}
          </div>
        </section>

        <aside className="editor-preview glass-panel" ref={previewRef}>
          <div className="panel-label"><span className="live-dot" aria-hidden="true" /><span className="sr-only">Presentation preview</span><button type="button" className="icon-button" onClick={() => void previewRef.current?.requestFullscreen?.()} aria-label="Open presentation preview full screen"><Maximize2 /></button></div>
          <SlideVisual slide={active} compact />
          <div className="teleprompter-preview">
            <TeleprompterText script={script} className="teleprompter-preview__script" />
            <div className="focus-line" aria-hidden="true" />
          </div>
        </aside>
      </div>
    </main>
  );
}
