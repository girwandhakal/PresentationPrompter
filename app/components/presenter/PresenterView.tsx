"use client";

import { ArrowLeft, ArrowRight, ChevronDown, EyeOff, Flag, Keyboard, LifeBuoy, Minus, MonitorUp, Pause, Play, Plus, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortId } from "@/lib/domain/factory";
import { formatClock } from "@/lib/domain/format";
import { planPresentation } from "@/lib/domain/planner";
import type { PresenterSession, Project } from "@/lib/domain/types";
import { usePref, type PresenterPrefs } from "@/lib/prefs";
import { putSession } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { AUDIENCE_TIMEOUT_MS, audienceWindowName, channelName, isAudienceMessage, type AudienceState } from "@/lib/sync/protocol";
import { SlideImage } from "../project/SlideImage";
import { Button, IconButton } from "../ui/button";
import { Kbd, Meter, Segmented } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { Menu } from "../ui/menu";
import { useToast } from "../ui/toast";
import { Preflight, PresenterSettings, RecoveryPanel, ShortcutsDialog, type AudienceStatus } from "./PresenterOverlays";
import { Teleprompter, type TeleprompterHandle } from "./Teleprompter";

type Phase = "preflight" | "calm" | "live";
type Overlay = null | "recovery" | "settings" | "shortcuts" | "end";

/** Accumulating stopwatch that survives pauses. */
function useStopwatch() {
  const accumulated = useRef(0);
  const since = useRef<number | null>(null);
  return useMemo(() => ({
    start() { if (since.current == null) since.current = performance.now(); },
    stop() { if (since.current != null) { accumulated.current += performance.now() - since.current; since.current = null; } },
    reset() { accumulated.current = 0; since.current = null; },
    running: () => since.current != null,
    ms: () => accumulated.current + (since.current != null ? performance.now() - since.current : 0),
  }), []);
}

export function PresenterView({ project }: { project: Project }) {
  const router = useRouter();
  const toast = useToast();
  const { update } = useProjects();
  const [prefs, setPrefs] = usePref("presenter");

  const [phase, setPhase] = useState<Phase>("preflight");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [blank, setBlank] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [audience, setAudience] = useState<AudienceStatus>("none");
  const [hint, setHint] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [recoveryLine, setRecoveryLine] = useState("");
  const [, setTick] = useState(0);

  const teleprompter = useRef<TeleprompterHandle>(null);
  const total = useStopwatch();
  const slideClock = useStopwatch();
  const slideTimes = useRef(new Map<string, { ms: number; visits: number }>());
  const recoveries = useRef(0);
  const session = useRef<{ id: string; startedAt: number } | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const seq = useRef(0);
  // Unique per page load so a reloaded presenter is never mistaken for a stale sender.
  const channelSession = useRef(`c-${Math.random().toString(36).slice(2, 12)}`);
  const lastHeartbeat = useRef(0);
  const audienceWindow = useRef<Window | null>(null);
  const ended = useRef(false);

  const slides = project.slides;
  const slide = slides[index];
  const next = slides[index + 1];
  const plan = useMemo(() => planPresentation(project.brief, slides), [project.brief, slides]);
  const targetTotal = plan.speakingSeconds;
  const targetSlide = plan.slides[index]?.seconds || 0;

  const live = phase === "live";
  const overlayOpen = overlay !== null || phase !== "live";

  // ── Audience window sync ────────────────────────────────────────────────
  const broadcast = useCallback((override: Partial<Pick<AudienceState, "ended" | "blank" | "index">> = {}) => {
    const current = override.index ?? index;
    const message: AudienceState = {
      v: 1,
      type: "state",
      seq: ++seq.current,
      session: channelSession.current,
      index: current,
      total: slides.length,
      slideId: slides[current]?.id ?? "",
      blank: override.blank ?? blank,
      ended: override.ended ?? false,
    };
    channel.current?.postMessage(message);
  }, [blank, index, slides]);

  const commandRef = useRef<(command: "next" | "previous") => void>(() => {});

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(channelName(project.id));
    channel.current = bc;
    bc.onmessage = (event) => {
      if (!isAudienceMessage(event.data)) return;
      const message = event.data;
      if (message.type === "bye") {
        lastHeartbeat.current = 0;
        setAudience((current) => current === "connected" ? "lost" : current);
        return;
      }
      lastHeartbeat.current = Date.now();
      setAudience("connected");
      if (message.type === "hello") broadcastRef.current();
      if (message.type === "command") commandRef.current(message.command);
    };
    const watchdog = window.setInterval(() => {
      if (lastHeartbeat.current && Date.now() - lastHeartbeat.current > AUDIENCE_TIMEOUT_MS) {
        lastHeartbeat.current = 0;
        setAudience("lost");
      }
    }, 1000);
    return () => {
      window.clearInterval(watchdog);
      bc.close();
    };
  }, [project.id]);

  const broadcastRef = useRef(broadcast);
  useEffect(() => { broadcastRef.current = broadcast; }, [broadcast]);
  useEffect(() => { broadcast(); }, [broadcast]);

  const openAudience = useCallback(() => {
    const opened = window.open(`/audience/${project.id}`, audienceWindowName(project.id), "popup,width=1280,height=720");
    if (!opened) {
      setAudience("blocked");
      return;
    }
    audienceWindow.current = opened;
    opened.focus();
    window.setTimeout(() => broadcastRef.current(), 600);
  }, [project.id]);

  // ── Navigation and timing ───────────────────────────────────────────────
  const recordSlide = useCallback(() => {
    const id = slides[index]?.id;
    if (!id) return;
    slideClock.stop();
    const entry = slideTimes.current.get(id) ?? { ms: 0, visits: 0 };
    slideTimes.current.set(id, { ms: entry.ms + slideClock.ms(), visits: entry.visits });
  }, [index, slideClock, slides]);

  const go = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, target));
    if (clamped === index) return;
    if (live) {
      recordSlide();
      const nextId = slides[clamped].id;
      const entry = slideTimes.current.get(nextId) ?? { ms: 0, visits: 0 };
      slideTimes.current.set(nextId, { ...entry, visits: entry.visits + 1 });
    }
    slideClock.reset();
    if (live && total.running()) slideClock.start();
    setIndex(clamped);
    setCountdown(null);
    setAtEnd(false);
  }, [index, live, recordSlide, slideClock, slides, total]);

  useEffect(() => {
    commandRef.current = (command) => go(index + (command === "next" ? 1 : -1));
  }, [go, index]);

  const toggleTimer = useCallback(() => {
    if (!live) return;
    if (total.running()) {
      total.stop();
      slideClock.stop();
      setHint("Timer paused");
    } else {
      total.start();
      slideClock.start();
      setHint(null);
    }
    setTick((value) => value + 1);
  }, [live, slideClock, total]);

  const begin = useCallback(() => {
    session.current = { id: shortId(12), startedAt: Date.now() };
    slideTimes.current = new Map([[slides[index].id, { ms: 0, visits: 1 }]]);
    total.start();
    slideClock.start();
    setPhase("live");
    setHint("Press Space to start scrolling");
    broadcastRef.current();
  }, [index, slideClock, slides, total]);

  const start = useCallback(() => {
    setOverlay(null);
    if (prefs.calmStart) setPhase("calm");
    else begin();
  }, [begin, prefs.calmStart]);

  useEffect(() => {
    if (phase !== "calm") return;
    const timer = window.setTimeout(begin, 4200);
    return () => window.clearTimeout(timer);
  }, [begin, phase]);

  // Display clock
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [live]);

  // Auto-advance countdown
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      go(index + 1);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => (value == null ? null : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, go, index]);

  const onScriptEnd = useCallback(() => {
    setAtEnd(true);
    if (!live || !playing) return;
    if (index === slides.length - 1) {
      setPlaying(false);
      return;
    }
    // Guard against a short or empty script advancing before the presenter has spoken.
    if (prefs.autoAdvance && slideClock.ms() > 3000) setCountdown(prefs.advanceDelay);
  }, [index, live, playing, prefs.advanceDelay, prefs.autoAdvance, slideClock, slides.length]);

  const onManualScroll = useCallback(() => {
    if (playing) {
      setPlaying(false);
      setHint("Paused — press Space to resume");
    }
    setCountdown(null);
  }, [playing]);

  const togglePlay = useCallback(() => {
    if (!live) return;
    setCountdown(null);
    setHint(null);
    if (!total.running()) {
      total.start();
      slideClock.start();
    }
    setPlaying((value) => !value);
  }, [live, slideClock, total]);

  // ── Session persistence ─────────────────────────────────────────────────
  const buildSession = useCallback((completed: boolean): PresenterSession | null => {
    if (!session.current) return null;
    const times = new Map(slideTimes.current);
    const currentId = slides[index]?.id;
    if (currentId) {
      const entry = times.get(currentId) ?? { ms: 0, visits: 1 };
      times.set(currentId, { ...entry, ms: entry.ms + slideClock.ms() });
    }
    return {
      id: session.current.id,
      projectId: project.id,
      startedAt: session.current.startedAt,
      endedAt: completed ? Date.now() : null,
      totalSeconds: Math.round(total.ms() / 1000),
      targetSeconds: targetTotal,
      completed,
      slides: slides.map((item, position) => ({
        slideId: item.id,
        seconds: Math.round((times.get(item.id)?.ms ?? 0) / 1000),
        visits: times.get(item.id)?.visits ?? 0,
        targetSeconds: plan.slides[position]?.seconds ?? 0,
      })),
      marked,
      recoveries: recoveries.current,
      skipped: slides.filter((item) => !item.optional && !(times.get(item.id)?.visits)).map((item) => item.id),
    };
  }, [index, marked, plan.slides, project.id, slideClock, slides, targetTotal, total]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      const snapshot = buildSession(false);
      if (snapshot) void putSession(snapshot).catch(() => {});
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [buildSession, live]);

  const finish = useCallback(async () => {
    if (ended.current) return;
    ended.current = true;
    setPlaying(false);
    broadcastRef.current({ ended: true });
    const snapshot = buildSession(true);
    if (!snapshot) {
      router.push(`/p/${project.id}`);
      return;
    }
    try {
      await putSession(snapshot);
      await update(project.id, (current) => ({ ...current, lastPresentedAt: Date.now() }), { touch: false });
    } catch {
      toast({ message: "The session couldn't be saved, but your script is safe.", tone: "error" });
    }
    router.push(`/p/${project.id}/review?session=${snapshot.id}`);
  }, [buildSession, project.id, router, toast, update]);

  const exit = useCallback(() => {
    if (live) setOverlay("end");
    else router.push(`/p/${project.id}`);
  }, [live, project.id, router]);

  // Keep the screen awake while presenting.
  useEffect(() => {
    if (!live || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => navigator.wakeLock.request("screen").then((sentinel) => {
      if (cancelled) void sentinel.release();
      else lock = sentinel;
    }).catch(() => {});
    void acquire();
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const warn = (event: BeforeUnloadEvent) => { if (!ended.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [live]);

  // Dim the controls while scrolling and the pointer is still.
  useEffect(() => {
    if (!playing) {
      setIdle(false);
      return;
    }
    let timer = window.setTimeout(() => setIdle(true), 2500);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("pointermove", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
    };
  }, [playing]);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 3500);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const openRecovery = useCallback(() => {
    setPlaying(false);
    setCountdown(null);
    recoveries.current += 1;
    setRecoveryLine(teleprompter.current?.currentLine() ?? "");
    setOverlay("recovery");
  }, []);

  const toggleMark = useCallback(() => {
    if (!slide) return;
    setMarked((current) => current.includes(slide.id) ? current.filter((id) => id !== slide.id) : [...current, slide.id]);
    setHint(marked.includes(slide.id) ? "Mark removed" : "Marked for review after the talk");
  }, [marked, slide]);

  const setPace = useCallback((delta: number) => {
    setPrefs((current: PresenterPrefs) => ({ ...current, paceMultiplier: Math.min(1.6, Math.max(0.6, Number((current.paceMultiplier + delta).toFixed(2)))) }));
  }, [setPrefs]);

  // ── Keyboard and clicker ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (overlayOpen) return;
      const key = event.key;
      const handled = (() => {
        switch (key) {
          case " ": togglePlay(); return true;
          case "ArrowRight": case "PageDown": case "n": case "N": go(index + 1); return true;
          case "ArrowLeft": case "PageUp": case "p": case "P": go(index - 1); return true;
          case "ArrowDown": teleprompter.current?.nudge(1); onManualScroll(); return true;
          case "ArrowUp": teleprompter.current?.nudge(-1); onManualScroll(); return true;
          case "Home": teleprompter.current?.restart(); setAtEnd(false); return true;
          case "End": teleprompter.current?.toEnd(); return true;
          case "r": case "R": openRecovery(); return true;
          case "b": case "B": case ".": setBlank((value) => !value); return true;
          case "c": case "C": setPrefs({ ...prefs, showCues: !prefs.showCues }); return true;
          case "m": case "M": toggleMark(); return true;
          case "+": case "=": setPace(0.05); return true;
          case "-": case "_": setPace(-0.05); return true;
          case "f": case "F": void toggleFullscreen(); return true;
          case "?": setOverlay("shortcuts"); return true;
          case "Escape":
            if (countdown != null) setCountdown(null);
            else exit();
            return true;
          default: return false;
        }
      })();
      if (handled) event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [countdown, exit, go, index, onManualScroll, openRecovery, overlayOpen, prefs, setPace, setPrefs, toggleMark, togglePlay]);

  if (!slide) return null;

  const elapsed = Math.round(total.ms() / 1000);
  const remaining = targetTotal - elapsed;
  const slideElapsed = Math.round(slideClock.ms() / 1000);
  const isMarked = marked.includes(slide.id);
  const timerPaused = live && !total.running();

  return (
    <div className="presenter theme-dark" data-idle={idle} data-phase={phase}>
      <header className="presenter__bar">
        <IconButton label={live ? "End presentation" : "Close presenter"} onClick={exit} tooltip="bottom"><X /></IconButton>
        <Menu
          label="Jump to slide"
          items={slides.map((item, position) => ({ label: `${position + 1}. ${item.title}`, onSelect: () => go(position), hint: marked.includes(item.id) ? "Marked" : item.optional ? "Optional" : undefined }))}
          trigger={(props) => (
            <button {...props} type="button" className="presenter__where">
              <span className="presenter__deck">{project.title}</span>
              <span className="presenter__slide tabular">Slide {index + 1} of {slides.length}<ChevronDown aria-hidden="true" /></span>
            </button>
          )}
        />
        <div className="presenter__spacer" />
        <button type="button" className="presenter__timer tabular" onClick={toggleTimer} disabled={!live} aria-label={`Elapsed ${formatClock(elapsed)} of ${formatClock(targetTotal)}. ${timerPaused ? "Resume" : "Pause"} timer`}>
          <span className="presenter__elapsed">{formatClock(elapsed)}</span>
          <span className="presenter__remaining">{remaining >= 0 ? `${formatClock(remaining)} left` : `${formatClock(-remaining)} over`}</span>
          {timerPaused && <span className="presenter__paused">Paused</span>}
        </button>
        <button type="button" className="audience-chip" data-status={audience} onClick={openAudience} aria-label={audience === "connected" ? "Audience window connected. Bring it to the front." : "Open the audience window"}>
          <MonitorUp aria-hidden="true" />
          <span>{audience === "connected" ? (blank ? "Audience: blank" : "Audience") : audience === "lost" ? "Audience closed — reopen" : audience === "blocked" ? "Pop-up blocked — retry" : "Open audience"}</span>
        </button>
        <IconButton label="Keyboard shortcuts" onClick={() => setOverlay("shortcuts")}><Keyboard /></IconButton>
        <IconButton label="Reading settings" onClick={() => setOverlay("settings")}><Settings2 /></IconButton>
      </header>

      <div className="presenter__body" data-context={prefs.showNext}>
        <section className="presenter__stage" aria-label="Teleprompter" aria-live="off">
          {prefs.focusLine && <div className="presenter__focus" aria-hidden="true" />}
          <Teleprompter
            ref={teleprompter}
            script={slide.script}
            slideKey={slide.id}
            prefs={prefs}
            playing={playing && live && overlay === null}
            wpm={project.brief.wpm}
            targetSeconds={targetSlide}
            onEnd={onScriptEnd}
            onManualScroll={onManualScroll}
          />
          {countdown != null && (
            <div className="presenter__countdown" role="status">
              <span>Next slide in <strong className="tabular">{countdown}</strong></span>
              <Button size="sm" variant="secondary" onClick={() => setCountdown(null)}>Stay here <Kbd>Esc</Kbd></Button>
            </div>
          )}
          {atEnd && index === slides.length - 1 && live && (
            <div className="presenter__countdown" role="status">
              <span>That&apos;s the end of your script.</span>
              <Button size="sm" variant="accent" onClick={() => void finish()}>End and review</Button>
            </div>
          )}
          {hint && countdown == null && <div className="presenter__hint" role="status">{hint}</div>}
        </section>

        {prefs.showNext && (
          <aside className="presenter__context" aria-label="Slides">
            <figure className="presenter__card">
              <figcaption>Now showing{blank && " (blanked)"}</figcaption>
              <div className="presenter__thumb" data-blank={blank}><SlideImage slide={slide} aspectRatio={project.aspectRatio} /></div>
            </figure>
            <div className="presenter__slide-time tabular">
              <span>This slide</span>
              <strong>{formatClock(slideElapsed)}{targetSlide ? ` / ${formatClock(targetSlide)}` : ""}</strong>
            </div>
            {targetSlide > 0 && <Meter value={slideElapsed} target={targetSlide} label={`${slideElapsed} of ${targetSlide} seconds on this slide`} />}
            <figure className="presenter__card presenter__card--next">
              <figcaption>{next ? `Next · ${index + 2}` : "Last slide"}</figcaption>
              {next ? <SlideImage slide={next} aspectRatio={project.aspectRatio} size="thumb" /> : <div className="presenter__end-card">End of deck{project.brief.qaMinutes ? " · Questions" : ""}</div>}
            </figure>
            {slide.script.transition && prefs.mode !== "cues" && (
              <p className="presenter__transition"><span>Transition</span>{slide.script.transition}</p>
            )}
          </aside>
        )}
      </div>

      <footer className="presenter__controls">
        <div className="presenter__controls-group">
          <Button variant="ghost" icon={<ArrowLeft />} onClick={() => go(index - 1)} disabled={index === 0} aria-keyshortcuts="ArrowLeft PageUp">Previous</Button>
          <button type="button" className="play-button" onClick={togglePlay} disabled={!live} aria-label={playing ? "Pause scrolling" : "Start scrolling"} aria-keyshortcuts="Space">
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <Button variant="ghost" trailing={<ArrowRight />} onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-keyshortcuts="ArrowRight PageDown">Next</Button>
        </div>
        <div className="presenter__controls-group presenter__controls-group--mid">
          <div className="pace" aria-label="Scroll pace">
            <IconButton size="sm" label="Slower (−)" onClick={() => setPace(-0.05)} tooltip="top"><Minus /></IconButton>
            <span className="pace__value tabular" aria-live="polite">{Math.round(prefs.paceMultiplier * 100)}%</span>
            <IconButton size="sm" label="Faster (+)" onClick={() => setPace(0.05)} tooltip="top"><Plus /></IconButton>
          </div>
          <Segmented size="sm" label="Reading mode" value={prefs.mode} onChange={(mode) => setPrefs({ ...prefs, mode })} options={[{ value: "full", label: "Script" }, { value: "notes", label: "Short" }, { value: "keywords", label: "Keywords" }, { value: "cues", label: "Cues" }]} />
        </div>
        <div className="presenter__controls-group">
          <Button variant="secondary" icon={<LifeBuoy />} onClick={openRecovery} aria-keyshortcuts="R">I lost my place</Button>
          <IconButton label={isMarked ? "Unmark slide (M)" : "Mark slide for review (M)"} aria-pressed={isMarked} onClick={toggleMark} tooltip="top"><Flag /></IconButton>
          <IconButton label={blank ? "Show slide to audience (B)" : "Blank audience screen (B)"} aria-pressed={blank} onClick={() => setBlank((value) => !value)} tooltip="top"><EyeOff /></IconButton>
        </div>
      </footer>
      <div className="presenter__deck-progress" aria-hidden="true">
        {slides.map((item, position) => <span key={item.id} data-state={position < index ? "done" : position === index ? "current" : "todo"} />)}
      </div>

      {phase === "calm" && (
        <div className="calm-start" role="status">
          <p className="calm-start__title">Take a breath.</p>
          <p className="calm-start__text">Your first line is ready. Starting in a moment.</p>
          <Button variant="ghost" onClick={begin}>Start now</Button>
        </div>
      )}

      <Preflight
        open={phase === "preflight"}
        project={project}
        audience={audience}
        onOpenAudience={openAudience}
        onStart={start}
        onClose={() => router.push(`/p/${project.id}`)}
        calmStart={prefs.calmStart}
        onCalmStart={(calmStart) => setPrefs({ ...prefs, calmStart })}
      />
      <RecoveryPanel
        open={overlay === "recovery"}
        slide={slide}
        currentLine={recoveryLine}
        onClose={() => setOverlay(null)}
        onRestartSlide={() => { teleprompter.current?.restart(); setAtEnd(false); setOverlay(null); }}
        onPrevious={() => { setOverlay(null); go(index - 1); }}
      />
      <PresenterSettings open={overlay === "settings"} prefs={prefs} onChange={setPrefs} onClose={() => setOverlay(null)} />
      <ShortcutsDialog open={overlay === "shortcuts"} onClose={() => setOverlay(null)} />
      <Dialog
        open={overlay === "end"}
        onClose={() => setOverlay(null)}
        size="sm"
        className="theme-dark"
        title="End the presentation?"
        description="The audience window will show “Thank you”, and you'll see how your timing went."
        footer={<>
          <Button variant="ghost" onClick={() => setOverlay(null)}>Keep presenting</Button>
          <Button variant="accent" onClick={() => void finish()}>End and review</Button>
        </>}
      />
    </div>
  );
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* refused: keep going */ }
}
