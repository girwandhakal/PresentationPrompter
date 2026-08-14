"use client";

import { ArrowLeft, Bold, Clock3, Eye, Italic, Menu, Mic2, Redo2, Sparkles, Undo2 } from "lucide-react";
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
import type { Presentation, Slide } from "./types";
import { CueNode, ScriptParagraphNode, $createCueNode } from "./script-nodes";
import { documentFromLexicalState, loadScriptDocument } from "./script-lexical";
import {
  documentFromLegacy,
  documentToDuration,
  documentToSpokenText,
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

function ElasticOverscroll({
  scrollRef,
  layerRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const scroll = scrollRef.current;
    const layer = layerRef.current;
    if (!scroll || !layer) return;

    let current = 0;
    let target = 0;
    let filteredSpeed = 0;
    let lastInputAt = 0;
    let lastFrameAt = 0;
    let frame = 0;
    let releaseTimer: number | undefined;

    function render(value: number) {
      current = value;
      layer.style.setProperty("--script-elastic-y", `${value.toFixed(3)}px`);
    }

    function animate(now: number) {
      const elapsed = lastFrameAt ? Math.min(40, now - lastFrameAt) : 16;
      lastFrameAt = now;
      const response = target === 0 ? 55 : 52;
      const blend = 1 - Math.exp(-elapsed / response);
      render(current + (target - current) * blend);

      if (Math.abs(target - current) < 0.05) {
        render(target);
        frame = 0;
        lastFrameAt = 0;
        return;
      }
      frame = requestAnimationFrame(animate);
    }

    function ensureAnimation() {
      if (!frame) frame = requestAnimationFrame(animate);
    }

    function release() {
      target = 0;
      filteredSpeed = 0;
      ensureAnimation();
    }

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || event.deltaY === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1;
      const delta = event.deltaY * multiplier;
      const maxScrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const available = delta < 0 ? scroll.scrollTop : maxScrollTop - scroll.scrollTop;
      const spill = Math.abs(delta) - Math.max(0, available);

      if (spill <= 0) {
        if (current !== 0 || target !== 0) release();
        return;
      }

      event.preventDefault();
      scroll.scrollTop = delta < 0 ? 0 : maxScrollTop;

      const now = event.timeStamp;
      const elapsed = lastInputAt ? Math.max(8, Math.min(80, now - lastInputAt)) : 16;
      lastInputAt = now;
      const speed = spill / elapsed;
      filteredSpeed = filteredSpeed * 0.7 + speed * 0.3;

      // Pull opposite the wheel direction, like a physical sheet reaching its edge.
      const direction = delta > 0 ? -1 : 1;
      const distance = Math.min(52, 6 + Math.log1p(spill) * 5 + Math.min(18, filteredSpeed * 7));
      target = direction * distance;

      if (releaseTimer) window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(release, 24);
      ensureAnimation();
    }

    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroll.removeEventListener("wheel", onWheel);
      if (releaseTimer) window.clearTimeout(releaseTimer);
      cancelAnimationFrame(frame);
      layer.style.removeProperty("--script-elastic-y");
    };
  }, [layerRef, scrollRef]);

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
  const [, setPendingCue] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elasticLayerRef = useRef<HTMLDivElement>(null);
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
            <div><h1>{active.title}</h1></div>
          </div>

          <LexicalComposer initialConfig={config} key={active.id}>
            <ToolbarPlugin onCue={startCue} />
            <EditorDocumentPlugin document={script} onChange={updateScript} />
            <CueKeyboardPlugin startCue={startCue} onCueState={setPendingCue} />
            <HistoryPlugin />
            <div className="script-editor-surface" aria-label="Spoken script editing surface">
              <div className="script-editor-scroll" ref={scrollRef}>
                <div className="script-editor-elastic-layer" ref={elasticLayerRef}>
                  <RichTextPlugin
                    contentEditable={<div ref={editorRef} className="script-editor-input"><ContentEditable aria-label="Script editor" /></div>}
                    placeholder={<div className="script-editor-placeholder">Start writing your script…</div>}
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                </div>
                <ElasticOverscroll scrollRef={scrollRef} layerRef={elasticLayerRef} />
              </div>
            </div>
          </LexicalComposer>
        </section>

      </div>
    </main>
  );
}
