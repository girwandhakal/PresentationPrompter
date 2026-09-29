"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Muted product recordings. They play only while on screen, never start on their own when the
 * visitor prefers reduced motion, and always have a pause control (WCAG 2.2.2).
 */
function usePlayback(videos: RefObject<HTMLVideoElement | null>[], root: RefObject<HTMLElement | null>) {
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const chosen = useRef<boolean | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) chosen.current ??= false;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const shouldPlay = visible && chosen.current !== false;
    for (const ref of videos) {
      const video = ref.current;
      if (!video) continue;
      if (shouldPlay) video.play().catch(() => setPlaying(false));
      else video.pause();
    }
    setPlaying(shouldPlay);
    // The refs are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = () => {
    const next = !playing;
    chosen.current = next;
    for (const ref of videos) {
      if (next) ref.current?.play().catch(() => {});
      else ref.current?.pause();
    }
    setPlaying(next);
  };
  return { playing, toggle };
}

function Toggle({ playing, onToggle, label }: { playing: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="clip__toggle" onClick={onToggle} aria-label={`${playing ? "Pause" : "Play"} ${label}`}>
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </button>
  );
}

type ClipProps = { src: string; poster: string; label: string; width: number; height: number; eager?: boolean; className?: string };

export function Clip({ src, poster, label, width, height, eager, className }: ClipProps) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const { playing, toggle } = usePlayback([video], root);
  return (
    <div ref={root} className={["clip", className].filter(Boolean).join(" ")} style={{ aspectRatio: `${width} / ${height}` }}>
      <video ref={video} src={src} poster={poster} width={width} height={height} muted loop playsInline preload={eager ? "auto" : "none"} aria-label={label} />
      <Toggle playing={playing} onToggle={toggle} label={label} />
    </div>
  );
}

type Side = { src: string; poster: string; label: string; width: number; height: number };

/** The presenter and audience recordings were captured together; keep them on the same frame. */
export function StagePair({ presenter, audience, presenterCaption, audienceCaption }: { presenter: Side; audience: Side; presenterCaption: string; audienceCaption: string }) {
  const root = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLVideoElement>(null);
  const follow = useRef<HTMLVideoElement>(null);
  const { playing, toggle } = usePlayback([lead, follow], root);

  useEffect(() => {
    const main = lead.current;
    const other = follow.current;
    if (!main || !other) return;
    const align = () => {
      if (Math.abs(other.currentTime - main.currentTime) > 0.15) other.currentTime = main.currentTime;
    };
    const restart = () => {
      main.currentTime = 0;
      other.currentTime = 0;
      void main.play().catch(() => {});
      void other.play().catch(() => {});
    };
    main.addEventListener("timeupdate", align);
    main.addEventListener("ended", restart);
    return () => {
      main.removeEventListener("timeupdate", align);
      main.removeEventListener("ended", restart);
    };
  }, []);

  return (
    <div ref={root} className="stage-pair">
      <figure className="stage-pair__side stage-pair__side--private">
        <figcaption><span className="stage-pair__dot" aria-hidden="true" />{presenterCaption}</figcaption>
        <div className="clip" style={{ aspectRatio: `${presenter.width} / ${presenter.height}` }}>
          <video ref={lead} src={presenter.src} poster={presenter.poster} width={presenter.width} height={presenter.height} muted playsInline preload="none" aria-label={presenter.label} />
        </div>
      </figure>
      <figure className="stage-pair__side">
        <figcaption><span className="stage-pair__dot" aria-hidden="true" />{audienceCaption}</figcaption>
        <div className="clip" style={{ aspectRatio: `${audience.width} / ${audience.height}` }}>
          <video ref={follow} src={audience.src} poster={audience.poster} width={audience.width} height={audience.height} muted playsInline preload="none" aria-label={audience.label} />
        </div>
      </figure>
      <Toggle playing={playing} onToggle={toggle} label="both recordings" />
    </div>
  );
}
