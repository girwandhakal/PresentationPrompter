"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  Gauge,
  Maximize2,
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

const deck = initialPresentations[0];

export default function PresenterPage() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const slide = deck.slides[index];

  const broadcast = useCallback((nextIndex = index) => {
    channelRef.current?.postMessage({ type: "snapshot", index: nextIndex, title: deck.title });
  }, [index]);

  useEffect(() => {
    const channel = new BroadcastChannel("cueframe-presenter-session");
    channelRef.current = channel;
    channel.onmessage = (event) => { if (event.data?.type === "ready") broadcast(); };
    return () => channel.close();
  }, [broadcast]);

  useEffect(() => { broadcast(); }, [index, broadcast]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  function move(next: number) {
    setIndex(Math.max(0, Math.min(deck.slides.length - 1, next)));
    setElapsed(0);
  }

  function openAudience() {
    const audience = window.open("/audience", "cueframe-audience", "popup,width=1280,height=720");
    setPopupBlocked(!audience);
    audience?.focus();
    window.setTimeout(() => broadcast(), 400);
  }

  return (
    <main className="presenter-shell">
      <header className="presenter-header glass-panel">
        <div className="presenter-header__left"><Link href="/" className="icon-button" aria-label="Close presenter"><X /></Link><div><strong>{deck.title}</strong></div></div>
        <div className="presenter-header__status"><span aria-label={`Audience window ${popupBlocked ? "blocked" : "ready"}`}><i /></span><span>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span></div>
        <div className="presenter-header__actions"><button className="icon-button" onClick={openAudience} aria-label="Open audience window" title="Open audience window"><MonitorUp /></button></div>
      </header>

      {popupBlocked && <div className="popup-warning"><span>Your browser blocked the audience window.</span><button onClick={openAudience}>Try again</button></div>}

      <div className="presenter-grid">
        <section className="prompt-stage glass-panel">
          <div className="prompt-stage__meta"><span>Slide {index + 1} of {deck.slides.length}</span><span><Gauge /> 130 wpm</span></div>
          <div className="prompt-script"><span className="prompt-before">{slide.body.split(" ").slice(0, 8).join(" ")}</span> <mark>{slide.body.split(" ").slice(8, 13).join(" ")}</mark> {slide.body.split(" ").slice(13).join(" ")}</div>
          <div className="prompt-focus-line"><i /></div>
          <div className="live-cue"><Eye /><div><span>{slide.cueType}</span><strong>{slide.cue}</strong></div></div>
          <div className="next-line"><p>{deck.slides[index + 1]?.body.split(".")[0] ?? "End the presentation and leave room for questions."}</p></div>
        </section>

        <aside className="presenter-context">
          <div className="context-card glass-panel"><div className="panel-label"><span className="sr-only">Current slide</span><Maximize2 /></div><SlideVisual slide={slide} compact /></div>
          <div className="context-card glass-panel is-next"><div className="panel-label"><span className="sr-only">Up next</span><span>{index + 2 > deck.slides.length ? "—" : index + 2}</span></div>{deck.slides[index + 1] ? <SlideVisual slide={deck.slides[index + 1]} compact /> : <div className="end-card"><CheckCircle2 /><span className="sr-only">Ready to close</span></div>}</div>
          <div className="session-progress glass-panel"><div><span className="sr-only">Session progress</span><strong>{Math.round(((index + 1) / deck.slides.length) * 100)}%</strong></div><div><i style={{ width: `${((index + 1) / deck.slides.length) * 100}%` }} /></div></div>
        </aside>
      </div>

      <footer className="presenter-controls glass-panel">
        <button onClick={() => move(index - 1)} disabled={index === 0} aria-label="Previous slide" title="Previous slide"><ArrowLeft /></button>
        <button onClick={() => { setElapsed(0); setPlaying(false); }} aria-label="Restart slide" title="Restart slide"><RotateCcw /></button>
        <button className="play-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause" : "Start"} title={playing ? "Pause" : "Start"}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
        <button onClick={() => move(index + 1)} disabled={index === deck.slides.length - 1} aria-label="Next slide" title="Next slide"><ArrowRight /></button>
      </footer>
    </main>
  );
}
