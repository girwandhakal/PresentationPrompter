"use client";

import {
  AlignLeft,
  ArrowLeft,
  Bold,
  Clock3,
  Eye,
  Maximize2,
  Menu,
  Mic2,
  Pause,
  Redo2,
  Save,
  Sparkles,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { SlideVisual } from "./SlideVisual";
import type { Presentation, Slide } from "./types";

type Props = {
  presentation: Presentation;
  onBack: () => void;
  onSave: (slides: Slide[]) => void;
  onOpenSidebar: () => void;
};

export function ScriptEditor({ presentation, onBack, onSave, onOpenSidebar }: Props) {
  const [slides, setSlides] = useState(presentation.slides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saved, setSaved] = useState(true);
  const previewRef = useRef<HTMLElement>(null);
  const active = slides[activeIndex];

  function update(field: keyof Slide, value: string) {
    setSlides((current) => current.map((slide, index) => index === activeIndex ? { ...slide, [field]: value } : slide));
    setSaved(false);
  }

  function insertMarker(marker: string) {
    update("body", `${active.body.trim()} ${marker}`);
  }

  function save() {
    onSave(slides);
    setSaved(true);
  }

  function openPreviewFullscreen() {
    void previewRef.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <main className="editor-workspace">
      <header className="editor-header">
        <div className="editor-header__left">
          <button className="icon-button mobile-menu" onClick={onOpenSidebar} aria-label="Open presentation sidebar"><Menu /></button>
          <button className="back-button" onClick={onBack} aria-label="Back to presentation" title="Back to presentation"><ArrowLeft /></button>
          <div><strong>{presentation.title}</strong></div>
        </div>
        <div className="editor-header__tools">
          <button className="icon-button" aria-label="Undo"><Undo2 /></button>
          <button className="icon-button" aria-label="Redo"><Redo2 /></button>
          <span className="saved-state" aria-label={saved ? "Saved" : "Unsaved changes"} title={saved ? "Saved" : "Unsaved changes"}><i className={saved ? "" : "is-unsaved"} /></span>
          <button className="header-icon header-icon--primary" onClick={save} aria-label="Save script" title="Save script"><Save /></button>
        </div>
      </header>

      <div className="editor-layout">
        <section className="editor-slide-list glass-panel">
          <div className="panel-label"><span className="sr-only">Slides</span><small>{slides.length}</small></div>
          {slides.map((slide, index) => (
            <button className={activeIndex === index ? "is-active" : ""} onClick={() => setActiveIndex(index)} key={slide.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{slide.title}</strong><small>{slide.duration} · {slide.marker}</small></div>
            </button>
          ))}
        </section>

        <section className="editor-canvas glass-panel">
          <div className="editor-canvas__top">
            <div><span className="eyebrow">Slide {activeIndex + 1} · {active.eyebrow}</span><h1>{active.title}</h1></div>
            <div className="duration-pill"><Clock3 /> {active.duration}</div>
          </div>
          <div className="editor-toolbar" role="toolbar" aria-label="Teleprompter markers">
            <button onClick={() => insertMarker("[pause]")} aria-label="Insert pause" title="Insert pause"><Pause /></button>
            <button onClick={() => insertMarker("[emphasize]")} aria-label="Insert emphasis" title="Insert emphasis"><Bold /></button>
            <button onClick={() => insertMarker("[look up]")} aria-label="Insert look up cue" title="Insert look up cue"><Eye /></button>
            <button onClick={() => insertMarker("[pronounce: ]")} aria-label="Insert pronunciation cue" title="Insert pronunciation cue"><Mic2 /></button>
            <button onClick={() => insertMarker("\n\n")} aria-label="Insert reading break" title="Insert reading break"><AlignLeft /></button>
          </div>
          <label className="script-editor-field">
            <span className="sr-only">Spoken script</span>
            <textarea value={active.body} onChange={(event) => update("body", event.target.value)} />
          </label>
          <div className="editor-stats">
            <span>{active.body.trim().split(/\s+/).length} words</span>
          </div>
          <label className="cue-editor"><span><Sparkles /><span className="sr-only">Delivery cue</span></span><textarea value={active.cue} onChange={(event) => update("cue", event.target.value)} rows={2} /></label>
          <div className="rewrite-actions">
            {["Make shorter", "More conversational", "Stronger transition"].map((action) => <button key={action} aria-label={action} title={action}><WandSparkles /></button>)}
          </div>
        </section>

        <aside className="editor-preview glass-panel" ref={previewRef}>
          <div className="panel-label">
            <span className="live-dot" aria-hidden="true" />
            <span className="sr-only">Presentation preview</span>
            <button className="icon-button" onClick={openPreviewFullscreen} aria-label="Open presentation preview full screen" title="Full screen"><Maximize2 /></button>
          </div>
          <SlideVisual slide={active} compact />
          <div className="teleprompter-preview">
            <p>{active.body}</p>
            <div className="focus-line" />
          </div>
        </aside>
      </div>
    </main>
  );
}
