"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const LINES = [
  "Hello, everyone.",
  "Every tree on this street was planted by someone who expected to be gone before it gave shade.",
  "This map shows where those trees are now,",
  "and where the gaps have opened.",
  "The orange streets lost the most canopy.",
  "They are also the hottest streets in summer.",
  "So the question for tonight is simple:",
  "where do we plant first?",
];

/**
 * A small working teleprompter: the script drifts up past the reading line, the way it does in the
 * real presenter view. The text is decorative (the section's heading says what it shows), so it is
 * hidden from assistive technology. It moves only on screen, never on its own under reduced
 * motion, and always has a pause control (WCAG 2.2.2).
 */
export function Prompter() {
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const chosen = useRef<boolean | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) chosen.current = false;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPlaying(visible && chosen.current !== false);
  }, [visible]);

  const toggle = () => {
    chosen.current = !playing;
    setPlaying(!playing);
  };

  return (
    <div ref={root} className="demo-prompter" data-playing={playing || undefined}>
      <div className="demo-prompter__window" aria-hidden="true">
        <div className="demo-prompter__roll">
          {/* Two copies, so the loop is seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="demo-prompter__copy">
              {LINES.map((line) => <p key={line}>{line}</p>)}
            </div>
          ))}
        </div>
        <span className="demo-prompter__line" />
      </div>
      <button type="button" className="clip__toggle" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} the teleprompter example`}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
    </div>
  );
}
