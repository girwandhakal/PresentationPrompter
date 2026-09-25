"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { documentToWordCount } from "@/lib/domain/script";
import type { SlideScript } from "@/lib/domain/types";
import type { PresenterPrefs } from "@/lib/prefs";
import { ScriptText } from "./ScriptText";

export type TeleprompterHandle = {
  restart: () => void;
  toEnd: () => void;
  nudge: (direction: 1 | -1) => void;
  /** Text of the line currently at the focus line, for "I lost my place". */
  currentLine: () => string;
};

/** Where the reading line sits, as a fraction of the viewport height. */
export const FOCUS_LINE = 0.36;

type Props = {
  script: SlideScript;
  slideKey: string;
  prefs: PresenterPrefs;
  playing: boolean;
  wpm: number;
  targetSeconds: number;
  onEnd: () => void;
  onManualScroll: () => void;
  onProgress?: (fraction: number) => void;
};

/**
 * Smooth, pace-linked scrolling. In full-script mode the speed comes from the presenter's words per
 * minute and the rendered height per word, so changing font size or width never changes timing.
 * In notes/keyword modes the slide's planned time sets the pace. Any manual scroll yields control.
 */
// Memoized: the presenter re-renders several times a second for its clocks.
export const Teleprompter = memo(forwardRef<TeleprompterHandle, Props>(function Teleprompter(
  { script, slideKey, prefs, playing, wpm, targetSeconds, onEnd, onManualScroll, onProgress },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const textHeight = useRef(0);
  const ended = useRef(false);
  const callbacks = useRef({ onEnd, onManualScroll, onProgress });
  useEffect(() => { callbacks.current = { onEnd, onManualScroll, onProgress }; }, [onEnd, onManualScroll, onProgress]);

  const maxScroll = () => {
    const element = scroller.current;
    return element ? Math.max(0, element.scrollHeight - element.clientHeight) : 0;
  };

  const report = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const max = maxScroll();
    const fraction = max ? element.scrollTop / max : 1;
    callbacks.current.onProgress?.(fraction);
    if (max > 0 && element.scrollTop >= max - 2) {
      if (!ended.current) {
        ended.current = true;
        callbacks.current.onEnd();
      }
    } else if (element.scrollTop < max - 24) {
      ended.current = false;
    }
  }, []);

  // New slide or reading mode: back to the top.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTop = 0;
    position.current = 0;
    ended.current = false;
    callbacks.current.onProgress?.(0);
  }, [slideKey, prefs.mode]);

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => { textHeight.current = element.offsetHeight; });
    observer.observe(element);
    textHeight.current = element.offsetHeight;
    return () => observer.disconnect();
  }, []);

  const words = documentToWordCount(script.document);

  useEffect(() => {
    if (!playing) return;
    const element = scroller.current;
    if (!element) return;
    position.current = element.scrollTop;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const height = textHeight.current || element.clientHeight;
      const speed = prefs.mode === "full" && words > 0
        ? (height / words) * (wpm / 60) * prefs.paceMultiplier
        : (height / Math.max(10, targetSeconds || 45)) * prefs.paceMultiplier;
      const max = maxScroll();
      position.current = Math.min(max, position.current + speed * dt);
      element.scrollTop = position.current;
      report();
      if (position.current < max) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, prefs.mode, prefs.paceMultiplier, report, targetSeconds, words, wpm, slideKey]);

  useImperativeHandle(ref, () => ({
    restart() {
      const element = scroller.current;
      if (!element) return;
      element.scrollTo({ top: 0, behavior: "smooth" });
      position.current = 0;
      ended.current = false;
    },
    toEnd() {
      const element = scroller.current;
      if (!element) return;
      element.scrollTo({ top: maxScroll(), behavior: "smooth" });
      position.current = maxScroll();
    },
    nudge(direction) {
      const element = scroller.current;
      if (!element) return;
      const step = prefs.fontSize * prefs.lineHeight * 2;
      element.scrollBy({ top: direction * step, behavior: "smooth" });
      position.current = Math.max(0, Math.min(maxScroll(), element.scrollTop + direction * step));
    },
    currentLine() {
      const element = scroller.current;
      if (!element) return "";
      const focusY = element.getBoundingClientRect().top + element.clientHeight * FOCUS_LINE;
      const lines = Array.from(element.querySelectorAll<HTMLElement>(".st-line"));
      const hit = lines.find((line) => {
        const rect = line.getBoundingClientRect();
        return rect.top <= focusY + 4 && rect.bottom >= focusY - 4;
      }) ?? lines.find((line) => line.getBoundingClientRect().top > focusY) ?? lines.at(-1);
      return hit?.textContent?.trim() ?? "";
    },
  }), [prefs.fontSize, prefs.lineHeight]);

  return (
    <div
      ref={scroller}
      className="teleprompter"
      data-mirror={prefs.mirror}
      data-contrast={prefs.highContrast ? "high" : "normal"}
      onWheel={() => callbacks.current.onManualScroll()}
      onTouchStart={() => callbacks.current.onManualScroll()}
      onScroll={report}
      style={{ "--st-size": `${prefs.fontSize}px`, "--st-leading": String(prefs.lineHeight), "--tp-width": `${prefs.width}%`, "--focus": String(FOCUS_LINE) } as React.CSSProperties}
      tabIndex={-1}
      aria-label="Script"
    >
      <div className="teleprompter__spacer teleprompter__spacer--top" aria-hidden="true" />
      <div ref={content} className="teleprompter__content">
        <ScriptText script={script} mode={prefs.mode} showCues={prefs.showCues} />
      </div>
      <div className="teleprompter__spacer teleprompter__spacer--bottom" aria-hidden="true" />
    </div>
  );
}));
