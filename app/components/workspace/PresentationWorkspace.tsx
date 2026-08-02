"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock3,
  Eye,
  Maximize2,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PenLine,
  Play,
  Sparkles,
  TimerReset,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlideVisual } from "./SlideVisual";
import type { Presentation } from "./types";

type Props = {
  presentation: Presentation;
  onEdit: () => void;
  onMenu: () => void;
  onOpenSidebar: () => void;
};

export function PresentationWorkspace({ presentation, onEdit, onMenu, onOpenSidebar }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = presentation.slides[activeIndex] ?? presentation.slides[0];
  const totalSeconds = presentation.slides.reduce((total, item) => {
    const [minutes, seconds] = item.duration.split(":").map(Number);
    return total + minutes * 60 + seconds;
  }, 0);

  if (!slide) return null;

  return (
    <main className="project-workspace">
      <header className="project-header">
        <button className="icon-button mobile-menu" onClick={onOpenSidebar} aria-label="Open presentation sidebar"><Menu /></button>
        <div className="project-heading">
          <div><h1>{presentation.title}</h1><button className="icon-button" onClick={onMenu} aria-label="Presentation actions"><MoreHorizontal /></button></div>
        </div>
        <div className="header-actions">
          <button className="header-icon" onClick={onEdit} aria-label="Edit script" title="Edit script"><PenLine size={17} /></button>
          <Link className="header-icon header-icon--primary" href="/presenter" aria-label="Start presentation" title="Start presentation"><Play size={17} fill="currentColor" /></Link>
        </div>
      </header>

      <div className="workspace-overview">
        <section className="slide-rail glass-panel" aria-label="Presentation slides">
          <div className="panel-label"><span className="sr-only">Slides</span><small>{presentation.slides.length}</small></div>
          <div className="slide-rail__list">
            {presentation.slides.map((item, index) => (
              <button className={index === activeIndex ? "is-active" : ""} onClick={() => setActiveIndex(index)} key={item.id}>
                <span className="slide-number">{String(index + 1).padStart(2, "0")}</span>
                <SlideVisual slide={item} compact />
                <span className="slide-rail__title">{item.title}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="preview-stage">
          <div className="preview-toolbar">
            <div><span className="live-dot" /><span className="sr-only">Slide preview</span></div>
            <button className="icon-button" aria-label="Expand preview"><Maximize2 /></button>
          </div>
          <div className="preview-frame glass-panel glass-panel--deep">
            <SlideVisual slide={slide} />
          </div>
          <div className="slide-navigation glass-panel">
            <button className="slide-navigation__control" aria-label="Previous slide" title="Previous slide" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}><ArrowLeft size={21} /></button>
            <span><strong>{activeIndex + 1}</strong> / {presentation.slides.length}</span>
            <button className="slide-navigation__control" aria-label="Next slide" title="Next slide" disabled={activeIndex === presentation.slides.length - 1} onClick={() => setActiveIndex((value) => Math.min(presentation.slides.length - 1, value + 1))}><ArrowRight size={21} /></button>
          </div>
        </section>

        <aside className="script-inspector glass-panel">
          <div className="inspector-heading">
            <div><span className="eyebrow"><MessageSquareText size={13} /> Script</span><h2>{slide.title}</h2></div>
            <button className="icon-button" onClick={onEdit} aria-label="Edit current slide script"><PenLine /></button>
          </div>
          <div className="script-copy">{slide.body}</div>
          <div className="cue-card">
            <span><Sparkles size={14} /> {slide.cueType}</span>
            <p>{slide.cue}</p>
          </div>
          <div className="timing-strip">
            <div title="Slide time"><Clock3 /><span className="sr-only">Slide time</span><strong>{slide.duration}</strong></div>
            <div title="Deck time"><TimerReset /><span className="sr-only">Deck time</span><strong>{Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, "0")}</strong></div>
          </div>
          <div className="presenter-peek">
            <div className="presenter-peek__header"><span><Eye size={14} /><span className="sr-only">Presenter preview</span></span><ChevronRight size={15} /></div>
            <p>{slide.body.split(".")[0]}<span className="focus-word"> {slide.body.split(" ").slice(5, 8).join(" ")}</span></p>
            <div><i style={{ width: `${presentation.progress}%` }} /></div>
          </div>
          <button className="ai-refine-button" onClick={onEdit} aria-label="Refine script" title="Refine script"><WandSparkles /></button>
        </aside>
      </div>
    </main>
  );
}
