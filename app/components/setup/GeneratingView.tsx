"use client";

import type { Project } from "@/lib/domain/types";
import { Button } from "../ui/button";

/** Script lines for the miniature teleprompter: widths in %, and which lines are private cues. */
const LINES: { width: number; cue?: boolean }[] = [
  { width: 92 }, { width: 78 }, { width: 86 }, { width: 38, cue: true }, { width: 64 },
  { width: 90 }, { width: 72 }, { width: 44 }, { width: 84 }, { width: 30, cue: true },
  { width: 76 }, { width: 88 }, { width: 58 },
];

/**
 * The single, calm state shown while a script is written. Deliberately no stage names, streaming,
 * or partial output: the presenter gets the finished draft or a clear message. The art is the
 * product in miniature: script lines drifting up past the Bluebell focus line.
 */
export function GeneratingView({ project, onCancel }: { project: Project; onCancel: () => void }) {
  return (
    <div className="generating" role="status" aria-live="polite">
      <div className="prompter" aria-hidden="true">
        <div className="prompter__roll">
          {/* Two copies, so the loop joins without a seam. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="prompter__page">
              {LINES.map((line, index) => (
                <span key={index} className={line.cue ? "prompter__line is-cue" : "prompter__line"} style={{ width: `${line.width}%` }} />
              ))}
            </div>
          ))}
        </div>
        <span className="prompter__focus" />
      </div>
      <h1 className="generating__title"><span className="shimmer-text">Writing your script</span></h1>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
