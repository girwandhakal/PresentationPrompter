"use client";

import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Eye,
  PenLine,
  Play,
  Sparkles,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { documentFirstCueLabel, documentToDuration, documentToSpokenText } from "./script-types";
import { SlideVisual } from "./SlideVisual";
import { usePresentations } from "./use-presentations";
import type { Presentation } from "./types";

type Props = {
  presentation: Presentation;
};

function durationToSeconds(duration: string) {
  const [m, sec] = duration.split(":").map(Number);
  return m * 60 + sec;
}

export function PresentationWorkspace({ presentation }: Props) {
  const { renamePresentation } = usePresentations();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(presentation.title);
  const cancelledRef = useRef(false);
  const slide = presentation.slides[activeIndex] ?? presentation.slides[0];

  const totalSeconds = presentation.slides.reduce(
    (sum, s) => sum + durationToSeconds(documentToDuration(s.script)),
    0,
  );

  function beginEdit() {
    cancelledRef.current = false;
    setTitleDraft(presentation.title);
    setIsEditingTitle(true);
  }

  function commitEdit() {
    if (!cancelledRef.current) renamePresentation(presentation.id, titleDraft);
    setIsEditingTitle(false);
  }

  function cancelEdit() {
    cancelledRef.current = true;
    setIsEditingTitle(false);
  }

  if (!slide) return null;

  const slideBody = documentToSpokenText(slide.script);
  const slideCue = documentFirstCueLabel(slide.script);
  const slideDuration = documentToDuration(slide.script);

  return (
    <main className="workspace">
      <header className="workspace-header">
        {isEditingTitle ? (
          <input
            autoFocus
            aria-label="Presentation title"
            className="workspace-title-input"
            value={titleDraft}
            onBlur={commitEdit}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") cancelEdit();
            }}
          />
        ) : (
          <h1
            className="workspace-title"
            role="button"
            tabIndex={0}
            title="Double-click to rename"
            onDoubleClick={beginEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); beginEdit(); }
            }}
          >
            {presentation.title}
          </h1>
        )}

        <div className="workspace-actions">
          <Link className="btn btn-secondary" href={`/p/${presentation.id}/edit`} aria-label="Edit script">
            <PenLine size={14} />
            Edit script
          </Link>
          <Link className="btn btn-primary" href={`/p/${presentation.id}/present`} aria-label="Start presentation">
            <Play size={14} fill="currentColor" />
            Present
          </Link>
        </div>
      </header>

      <div className="workspace-body">
        <section className="slide-rail" aria-label="Slides">
          <div className="rail-header">{presentation.slides.length} slides</div>
          <div className="rail-list">
            {presentation.slides.map((s, i) => (
              <button
                key={s.id}
                className={`rail-thumb ${i === activeIndex ? "is-active" : ""}`}
                onClick={() => setActiveIndex(i)}
              >
                <span className="rail-thumb-num">{String(i + 1).padStart(2, "0")}</span>
                <SlideVisual slide={s} compact />
                <span className="rail-thumb-label">{s.title}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="preview-stage">
          <div className="preview-card">
            <SlideVisual slide={slide} />
          </div>
          <div className="preview-nav">
            <button
              className="preview-nav-btn"
              aria-label="Previous slide"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((n) => Math.max(0, n - 1))}
            >
              <ArrowLeft size={18} />
            </button>
            <span className="preview-nav-count">
              <strong>{activeIndex + 1}</strong> / {presentation.slides.length}
            </span>
            <button
              className="preview-nav-btn"
              aria-label="Next slide"
              disabled={activeIndex === presentation.slides.length - 1}
              onClick={() => setActiveIndex((n) => Math.min(presentation.slides.length - 1, n + 1))}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <aside className="script-panel" aria-label="Script">
          <div className="script-panel-head">
            <div>
              <p className="script-panel-eyebrow">Script</p>
              <h2 className="script-panel-title">{slide.title}</h2>
            </div>
            <Link className="btn-icon" href={`/p/${presentation.id}/edit`} aria-label="Edit slide script">
              <PenLine size={15} />
            </Link>
          </div>

          <div className="script-panel-body">
            <p className="script-body">{slideBody}</p>

            {slideCue && (
              <div className="cue-block">
                <div className="cue-block-label">
                  <Sparkles size={11} /> Cue
                </div>
                <p className="cue-block-text">{slideCue}</p>
              </div>
            )}

            <div className="timing-row">
              <div className="timing-chip">
                <Clock3 size={13} />
                <div>
                  <span className="timing-chip-label">Slide</span>
                  <span className="timing-chip-value">{slideDuration}</span>
                </div>
              </div>
              <div className="timing-chip">
                <TimerReset size={13} />
                <div>
                  <span className="timing-chip-label">Total</span>
                  <span className="timing-chip-value">
                    {Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>

            <div className="peek-card">
              <div className="peek-card-label">
                <Eye size={11} /> Presenter view
              </div>
              <p className="peek-card-text">
                {slideBody.split(".")[0]}
                <span className="peek-card-highlight"> {slideBody.split(" ").slice(5, 9).join(" ")}</span>
              </p>
              <div className="peek-progress">
                <i style={{ width: `${presentation.progress}%` }} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
