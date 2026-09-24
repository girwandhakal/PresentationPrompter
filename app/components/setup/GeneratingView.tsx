"use client";

import type { Project } from "@/lib/domain/types";
import { pluralize } from "@/lib/domain/format";
import { Button } from "../ui/button";

/**
 * The single, calm state shown while a script is written. Deliberately no stage names, streaming,
 * or partial output: the presenter gets the finished draft or a clear message.
 */
export function GeneratingView({ project, onCancel }: { project: Project; onCancel: () => void }) {
  return (
    <div className="generating" role="status" aria-live="polite">
      <div className="generating__art" aria-hidden="true">
        <span /><span className="is-cue" /><span /><span />
      </div>
      <h1 className="generating__title">Writing your script</h1>
      <p className="generating__text">
        {pluralize(project.slides.length, "slide")}, {project.brief.minutes} minutes. This usually takes a minute or two.
        You can move around the app while it works. Keep this tab open.
      </p>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
