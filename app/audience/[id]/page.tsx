"use client";

import { Maximize } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { getProject } from "@/lib/store/db";
import { useBlobUrl } from "@/lib/store/blob-url";
import { audienceWindowName, channelName, HEARTBEAT_MS, isAudienceState, type AudienceCommand, type AudienceMessage, type AudienceState } from "@/lib/sync/protocol";

type AudienceSlide = { id: string; imageKey: string; title: string };

/**
 * The window the room sees. It loads only slide images from local storage (never scripts or cues)
 * and follows the private Presenter tab over BroadcastChannel. Clicker keys pressed while this
 * window has focus are forwarded to the presenter so both views stay in step.
 */
export default function AudiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [slides, setSlides] = useState<AudienceSlide[] | null>(null);
  const [title, setTitle] = useState("");
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<AudienceState | null>(null);
  const [chrome, setChrome] = useState(true);
  const channel = useRef<BroadcastChannel | null>(null);
  const windowId = useRef("");
  const lastSeq = useRef<{ session: string; seq: number } | null>(null);

  useEffect(() => {
    let active = true;
    getProject(id).then((project) => {
      if (!active) return;
      if (!project) return setMissing(true);
      // Deliberately keep only what the audience may see.
      setSlides(project.slides.map((slide) => ({ id: slide.id, imageKey: slide.imageKey || slide.thumbKey, title: slide.title })));
      setTitle(project.title);
    }).catch(() => { if (active) setMissing(true); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    document.title = title ? `Audience · ${title}` : "Audience · Cueframe";
  }, [title]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    windowId.current ||= `w-${Math.random().toString(36).slice(2, 10)}`;
    const bc = new BroadcastChannel(channelName(id));
    channel.current = bc;
    const send = (message: AudienceMessage) => bc.postMessage(message);
    bc.onmessage = (event) => {
      if (!isAudienceState(event.data)) return;
      const message = event.data;
      const previous = lastSeq.current;
      if (previous && previous.session === message.session && message.seq <= previous.seq) return;
      lastSeq.current = { session: message.session, seq: message.seq };
      setState(message);
    };
    send({ v: 1, type: "hello", window: windowId.current });
    const beat = window.setInterval(() => send({ v: 1, type: "heartbeat", window: windowId.current }), HEARTBEAT_MS);
    const bye = () => send({ v: 1, type: "bye", window: windowId.current });
    window.addEventListener("pagehide", bye);
    return () => {
      window.clearInterval(beat);
      window.removeEventListener("pagehide", bye);
      bye();
      bc.close();
    };
  }, [id]);

  useEffect(() => {
    window.name = audienceWindowName(id);
    const command = (value: AudienceCommand) => channel.current?.postMessage({ v: 1, type: "command", window: windowId.current, command: value } satisfies AudienceMessage);
    function onKey(event: KeyboardEvent) {
      if (["ArrowRight", "PageDown", " ", "Enter", "n", "N"].includes(event.key)) { event.preventDefault(); command("next"); }
      else if (["ArrowLeft", "PageUp", "Backspace", "p", "P"].includes(event.key)) { event.preventDefault(); command("previous"); }
      else if (event.key === "f" || event.key === "F") void toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  useEffect(() => {
    let timer = window.setTimeout(() => setChrome(false), 2500);
    const show = () => {
      setChrome(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChrome(false), 2500);
    };
    window.addEventListener("mousemove", show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", show);
    };
  }, []);

  const slide = state && slides ? slides[Math.min(state.index, slides.length - 1)] : null;

  return (
    <main className="audience" data-chrome={chrome} onDoubleClick={() => void toggleFullscreen()}>
      <h1 className="sr-only">{title || "Audience view"}</h1>
      {missing ? (
        <p className="audience__message">This presentation isn&apos;t available in this browser.</p>
      ) : !state ? (
        <p className="audience__message">Waiting for the presenter…<span>Share this window with your audience. Press F for full screen.</span></p>
      ) : state.ended ? (
        <p className="audience__message audience__message--quiet" aria-live="polite">Thank you</p>
      ) : state.blank ? (
        <div className="audience__blank" aria-label="Screen paused" />
      ) : slide ? (
        <AudienceSlideImage key={slide.id} slide={slide} />
      ) : null}
      <button type="button" className="audience__fullscreen" onClick={() => void toggleFullscreen()} aria-label="Toggle full screen">
        <Maximize aria-hidden="true" /> Full screen <kbd>F</kbd>
      </button>
    </main>
  );
}

function AudienceSlideImage({ slide }: { slide: AudienceSlide }) {
  const { url } = useBlobUrl(slide.imageKey);
  if (!url) return <div className="audience__fallback"><span>{slide.title}</span></div>;
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL
  return <img className="audience__slide" src={url} alt={slide.title} />;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* fullscreen can be refused; the window still works */ }
}
