"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";
import type { Project, Slide, SlideScript } from "@/lib/domain/types";
import { usePref } from "@/lib/prefs";
import { ScriptText } from "../presenter/ScriptText";
import { SlideImage } from "../project/SlideImage";
import { Segmented } from "../ui/controls";

export function Inspector({ project, slide }: { project: Project; slide: Slide }) {
  const [prefs] = usePref("presenter");
  const [previewMode, setPreviewMode] = useState(prefs.mode === "cues" ? "full" : prefs.mode);
  const script: SlideScript = slide.script;
  const warnings = slide.warnings.filter((warning) => warning.kind !== "sparse-text");

  return (
    <aside className="inspector" aria-label="Slide details">
      <div className="inspector__panel">
        <SlideImage slide={slide} aspectRatio={project.aspectRatio} priority />
        {warnings.map((warning) => (
          <p key={warning.message} className="inspector__warning"><AlertCircle aria-hidden="true" /> {warning.message}</p>
        ))}

        <div className="inspector__group">
          <h3 className="inspector__heading">Preview</h3>
          <Segmented size="sm" label="Reading mode" value={previewMode} onChange={setPreviewMode} options={[{ value: "full", label: "Script" }, { value: "notes", label: "Short" }, { value: "keywords", label: "Keywords" }]} />
          <div className="presenter-preview theme-dark">
            <ScriptText script={script} mode={previewMode} showCues={prefs.showCues} />
          </div>
        </div>
      </div>
    </aside>
  );
}
