"use client";

import { FileText } from "lucide-react";
import type { ImporterState } from "./use-importer";
import { Button } from "../ui/button";

export function ImportProgressCard({ state, onCancel }: { state: Extract<ImporterState, { status: "working" }>; onCancel: () => void }) {
  const { stage, done, total } = state.progress;
  const label = stage === "reading"
    ? "Opening file…"
    : stage === "saving"
      ? "Saving slides…"
      : total > 1 ? `Preparing slide ${Math.min(done + 1, total)} of ${total}` : "Preparing slide…";
  const percent = stage === "saving" ? 100 : stage === "reading" ? 4 : Math.round((done / Math.max(1, total)) * 100);
  return (
    <div className="import-progress" role="status" aria-live="polite">
      <div className="import-progress__file">
        <span className="import-progress__icon" aria-hidden="true"><FileText /></span>
        <div className="import-progress__text">
          <p className="import-progress__name">{state.fileName}</p>
          <p className="import-progress__label">{label}</p>
        </div>
        {stage !== "saving" && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
      </div>
      <div className="import-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Import progress">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="import-progress__note">Slides are processed on this device. Nothing is uploaded until you ask for a script.</p>
    </div>
  );
}
