"use client";

import { ArrowLeft, ArrowRight, Check, ChevronLeft, Pause, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SlideVisual } from "./SlideVisual";
import type { Presentation, Slide } from "./types";

type Props = {
  presentation: Presentation;
  onBack: () => void;
  onSave: (slides: Slide[]) => void;
};

const MARKERS = [
  { label: "Pause", value: "[pause]" },
  { label: "Emphasize", value: "[emphasize]" },
  { label: "Look up", value: "[look up]" },
  { label: "Pronunciation", value: "[pronounce: ]" },
] as const;

function wordCount(value: string) {
  return value.replace(/\[[^\]]*\]/g, "").trim().split(/\s+/).filter(Boolean).length;
}

function readingTime(words: number) {
  const seconds = Math.ceil((words / 130) * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ScriptEditor({ presentation, onBack, onSave }: Props) {
  const [slides, setSlides] = useState(presentation.slides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const slidesRef = useRef(slides);
  const active = slides[activeIndex];
  const totalWords = slides.reduce((sum, slide) => sum + wordCount(slide.body), 0);

  function changeSlide(patch: Partial<Slide>) {
    setSlides((current) => {
      const next = current.map((slide, index) => index === activeIndex ? { ...slide, ...patch } : slide);
      slidesRef.current = next;
      return next;
    });
    setDirty(true);
  }

  function save() {
    onSave(slidesRef.current);
    setDirty(false);
  }

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      onSave(slidesRef.current);
      setDirty(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, slides, onSave]);

  function insert(value: string) {
    const input = scriptRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const before = active.body.slice(0, start);
    const after = active.body.slice(end);
    const spacerBefore = before && !/\s$/.test(before) ? " " : "";
    const spacerAfter = after && !/^\s/.test(after) ? " " : "";
    changeSlide({ body: `${before}${spacerBefore}${value}${spacerAfter}${after}` });
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + spacerBefore.length + (value === "[pronounce: ]" ? value.length - 1 : value.length);
      input.setSelectionRange(caret, caret);
    });
  }

  function leave() {
    if (dirty) save();
    onBack();
  }

  if (!active) return null;

  return (
    <main className="editor" onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    }}>
      <header className="editor-header">
        <button className="editor-back" onClick={leave} aria-label="Back to presentation"><ArrowLeft size={18} /></button>
        <div className="editor-heading">
          <strong>{presentation.title}</strong>
          <span>Script editor</span>
        </div>
        <div className="editor-header-right">
          <span className="editor-save-state" role="status">{dirty ? "Saving…" : <><Check size={14} /> Saved</>}</span>
          <button className="btn btn-secondary editor-save-button" onClick={save} disabled={!dirty}><Save size={14} /> Save</button>
        </div>
      </header>

      <div className={`editor-body ${previewOpen ? "" : "editor-body--no-preview"}`}>
        <nav className="editor-slide-list" aria-label="Slides">
          <div className="editor-list-header"><strong>Slides</strong><span>{slides.length}</span></div>
          <div className="editor-list-items">
            {slides.map((slide, index) => (
              <button key={slide.id} className={`editor-slide-item ${index === activeIndex ? "is-active" : ""}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)}>
                <span className="editor-item-num">{String(index + 1).padStart(2, "0")}</span>
                <span className="editor-item-content"><strong>{slide.title || `Slide ${index + 1}`}</strong><span>{wordCount(slide.body)} words · {readingTime(wordCount(slide.body))}</span></span>
              </button>
            ))}
          </div>
          <div className="editor-list-footer">{totalWords} words · about {readingTime(totalWords)} total</div>
        </nav>

        <section className="editor-canvas" aria-label={`Edit slide ${activeIndex + 1}`}>
          <div className="editor-canvas-inner">
            <div className="editor-slide-meta"><span>Slide {activeIndex + 1} of {slides.length}</span><button onClick={() => setPreviewOpen((open) => !open)} aria-expanded={previewOpen}>{previewOpen ? "Hide preview" : "Show preview"}</button></div>
            <label className="editor-title-label" htmlFor="editor-slide-title">Slide title</label>
            <input id="editor-slide-title" className="editor-title-input" value={active.title} onChange={(event) => changeSlide({ title: event.target.value })} placeholder="Slide title" />

            <div className="editor-script-heading"><label htmlFor="editor-script">Spoken script</label><span>{wordCount(active.body)} words · about {readingTime(wordCount(active.body))}</span></div>
            <div className="editor-toolbar" role="toolbar" aria-label="Insert script cues">
              {MARKERS.map((marker) => <button key={marker.label} onClick={() => insert(marker.value)} title={`Insert ${marker.label.toLowerCase()} cue`}>{marker.label === "Pause" && <Pause size={13} />}{marker.label}</button>)}
              <button onClick={() => insert("\n\n")} title="Insert paragraph break">Paragraph break</button>
            </div>
            <textarea ref={scriptRef} id="editor-script" className="editor-script-input" value={active.body} onChange={(event) => changeSlide({ body: event.target.value })} placeholder="Write what you want to say on this slide…" spellCheck />
            <p className="editor-script-help">Cues in square brackets stay visible in the presenter script. Select text or place the cursor before inserting a cue.</p>

            <label className="editor-cue-label" htmlFor="editor-delivery-cue">Delivery note</label>
            <textarea id="editor-delivery-cue" className="editor-cue-input" value={active.cue} onChange={(event) => changeSlide({ cue: event.target.value })} placeholder="A reminder for how to deliver this slide" rows={2} />

            <div className="editor-slide-nav">
              <button onClick={() => setActiveIndex((index) => index - 1)} disabled={activeIndex === 0}><ChevronLeft size={16} /> Previous</button>
              <button onClick={() => setActiveIndex((index) => index + 1)} disabled={activeIndex === slides.length - 1}>Next slide <ArrowRight size={16} /></button>
            </div>
          </div>
        </section>

        {previewOpen && <aside className="editor-preview" aria-label="Live preview">
          <div className="editor-preview-head"><strong>Preview</strong><span>Updates as you type</span></div>
          <div className="editor-preview-body">
            <div className="editor-preview-slide"><SlideVisual slide={active} compact /></div>
            <div className="editor-preview-script"><span>Presenter view</span><p>{active.body || "Your script will appear here."}</p></div>
            {active.cue && <div className="editor-preview-note"><span>Delivery note</span><p>{active.cue}</p></div>}
          </div>
        </aside>}
      </div>
    </main>
  );
}
