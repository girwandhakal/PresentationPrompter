"use client";

import { AnimatePresence, LazyMotion, MotionConfig, m, type Transition } from "motion/react";
import type { ReactNode } from "react";

/**
 * Shared motion vocabulary. CSS handles hover, press, and entrances; Motion is only used where CSS
 * can't do the job: elements that glide between positions (layoutId), exit animations, and layout
 * reflow. Features load after first paint, so the initial bundle only carries the `m` shell.
 */
const loadFeatures = () => import("./motion-features").then((module) => module.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={SPRING}>{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Default: settles quickly with the faintest overshoot. */
export const SPRING: Transition = { type: "spring", duration: 0.45, bounce: 0.14 };
/** For indicators that glide between siblings (segmented puck, tab underline, highlights). */
export const GLIDE: Transition = { type: "spring", duration: 0.38, bounce: 0.1 };
/** Exits are quicker than entrances and never bounce. */
export const EXIT: Transition = { duration: 0.14, ease: [0.55, 0, 1, 0.45] };

/**
 * Text whose characters roll like an odometer when they change (timers, counts, durations). Only the
 * characters that changed move. The rendered text is always the real value, so it stays readable to
 * assistive tech and text search.
 */
export function RollingText({ value, className, direction = "up" }: { value: string; className?: string; direction?: "up" | "down" }) {
  const offset = direction === "up" ? "0.7em" : "-0.7em";
  // Key by distance from the end so "9:59" → "10:00" rolls the right columns.
  const chars = Array.from(value);
  return (
    <span className={["rolling", className].filter(Boolean).join(" ")}>
      {chars.map((char, index) => (
        <span key={chars.length - index} className="rolling__slot">
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              key={char}
              className="rolling__char"
              initial={{ y: offset, opacity: 0, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: direction === "up" ? "-0.7em" : "0.7em", opacity: 0, filter: "blur(2px)", transition: EXIT }}
              transition={SPRING}
            >
              {char === " " ? " " : char}
            </m.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/**
 * AI output arriving: each word comes into focus a beat after the one before (rack focus, not
 * typewriter). Pure CSS; `max` caps the total stagger for long passages.
 */
export function RevealWords({ text, max = 40 }: { text: string; max?: number }) {
  const words = text.split(/(\s+)/);
  let index = 0;
  return (
    <>
      {words.map((word, position) => {
        if (!word.trim()) return word;
        const delay = Math.min(index++, max);
        return <span key={position} className="reveal-word" style={{ "--w": delay } as React.CSSProperties}>{word}</span>;
      })}
    </>
  );
}
