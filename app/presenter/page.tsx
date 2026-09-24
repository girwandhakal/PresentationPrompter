"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gauge,
  MonitorUp,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialPresentations } from "../components/workspace/mock-data";
import { SlideVisual } from "../components/workspace/SlideVisual";
import { TeleprompterText } from "../components/workspace/TeleprompterText";
import { documentToSpokenText, parseScriptDocument } from "../components/workspace/script-types";
import type { Presentation } from "../components/workspace/types";

const STORAGE_KEY = "cueframe-presentations-v2";
const ACTIVE_STORAGE_KEY = "cueframe-active-presentation-v1";

export default function PresenterPage() {
  const [deck, setDeck] = useState<Presentation>(initialPresentations[0]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const slide = deck.slides[index];
  const script = parseScriptDocument(slide.script, slide.body, slide.cue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const activeId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      if (!stored) return;
      const presentations = JSON.parse(stored) as Presentation[];
      const selected = presentations.find((presentation) => presentation.id === activeId) ?? presentations[0];
      if (selected?.slides.length) queueMicrotask(() => setDeck(selected));
    } catch { /* use the sample deck when local storage is unavailable */ }
  }, []);

  const broadcast = useCallback((nextIndex = index) => {
    channelRef.current?.postMessage({ type: "snapshot", index: nextIndex, title: deck.title });
  }, [deck.title, index]);

  useEffect(() => {
    const ch = new BroadcastChannel("cueframe-presenter-session");
    channelRef.current = ch;
    ch.onmessage = (e) => { if (e.data?.type === "ready") broadcast(); };
    return () => ch.close();
  }, [broadcast]);

  useEffect(() => { broadcast(); }, [index, broadcast]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  function move(next: number) {
    setIndex(Math.max(0, Math.min(deck.slides.length - 1, next)));
    setElapsed(0);
  }

  function openAudience() {
    const win = window.open("/audience", "cueframe-audience", "popup,width=1280,height=720");
    setPopupBlocked(!win);
    win?.focus();
    window.setTimeout(() => broadcast(), 400);
  }

  const timer = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const progress = ((index + 1) / deck.slides.length) * 100;

  return (
    <main className="presenter-shell">
      <header className="presenter-header">
        <div className="presenter-header-left">
          <Link href="/" className="btn-icon" aria-label="Close presenter" style={{ color: "var(--powder)", borderColor: "color-mix(in srgb, white 14%, transparent)" }}>
            <X size={16} />
          </Link>
          <div>
            <p className="presenter-deck-title">{deck.title}</p>
            <p className="presenter-deck-slide">Slide {index + 1} of {deck.slides.length}</p>
          </div>
        </div>

        <div className="presenter-status">
          <span className="presenter-live"><i /> Live</span>
          <span>{timer}</span>
        </div>

        <div className="presenter-header-right">
          <button className="btn-icon" onClick={openAudience} aria-label="Open audience window">
            <MonitorUp size={16} />
          </button>
        </div>
      </header>

      {popupBlocked && (
        <div className="popup-warning">
          <span>Browser blocked the audience window.</span>
          <button onClick={openAudience}>Try again</button>
        </div>
      )}

      <div className="presenter-body">
        <section className="prompt-stage">
          <div className="prompt-meta">
            <span>Slide {index + 1} of {deck.slides.length}</span>
            <span><Gauge size={12} /> 130 wpm</span>
          </div>

          <TeleprompterText className="prompt-text" script={script} />

          <div className="prompt-line"><i /></div>

          <div className="live-cue-bar">
            <Play size={15} />
            <div>
              <p className="live-cue-type">{slide.cueType}</p>
              <p className="live-cue-text">{slide.cue}</p>
            </div>
          </div>

          <p className="next-hint">
            {deck.slides[index + 1] ? documentToSpokenText(parseScriptDocument(deck.slides[index + 1].script, deck.slides[index + 1].body, deck.slides[index + 1].cue)).split(".")[0] : "End of presentation — leave room for questions."}
          </p>
        </section>

        <aside className="presenter-context">
          <div className="ctx-card">
            <p className="ctx-card-label">Current</p>
            <SlideVisual slide={slide} compact />
          </div>

          <div className="ctx-card is-next">
            <p className="ctx-card-label">Up next · {index + 2 > deck.slides.length ? "—" : index + 2}</p>
            {deck.slides[index + 1] ? (
              <SlideVisual slide={deck.slides[index + 1]} compact />
            ) : (
              <div className="ctx-end">
                <CheckCircle2 size={20} />
                <span>End</span>
              </div>
            )}
          </div>

          <div className="session-card">
            <div className="session-stats">
              <span>Progress</span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <div className="session-bar">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </aside>
      </div>

      <footer className="presenter-controls">
        <button
          className="ctrl-btn"
          onClick={() => move(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <ArrowLeft size={16} />
          <span>Prev</span>
        </button>
        <button
          className="ctrl-btn"
          onClick={() => { setElapsed(0); setPlaying(false); }}
          aria-label="Restart"
        >
          <RotateCcw size={16} />
          <span>Restart</span>
        </button>
        <button
          className="ctrl-btn play"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <button
          className="ctrl-btn"
          onClick={() => move(index + 1)}
          disabled={index === deck.slides.length - 1}
          aria-label="Next slide"
        >
          <ArrowRight size={16} />
          <span>Next</span>
        </button>
      </footer>
    </main>
  );
}
