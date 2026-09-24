"use client";

import {
  Check,
  FileImage,
  FileText,
  LoaderCircle,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Presentation, Slide } from "./types";

type Props = {
  onGenerated: (presentation: Presentation) => void;
};

export function NewPresentationFlow({ onGenerated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [minutes, setMinutes] = useState(8);
  const [wpm, setWpm] = useState(130);
  const [depth, setDepth] = useState("Full script");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const wordBudget = useMemo(() => Math.round(minutes * wpm * 0.88), [minutes, wpm]);
  const valid = Boolean(file && title.trim() && goal.trim() && audience.trim());

  function chooseFile(next?: File) {
    if (!next) return;
    setFile(next);
    if (!title) setTitle(next.name.replace(/\.(pdf|pptx?|png|jpe?g|webp)$/i, "").replace(/[-_]+/g, " "));
    setError("");
  }

  async function generate() {
    if (!file || !valid) return;
    setGenerating(true);
    setError("");

    try {
      const form = new FormData();
      form.set("file", file);
      form.set("goal", goal);
      form.set("preset", goal);
      form.set("audience", audience);
      form.set("targetMinutes", String(minutes));

      const res = await fetch("/api/generate-script", { method: "POST", body: form });
      const result = await res.json() as { error?: string; deckTitle?: string; slides?: Record<string, string>[] };
      if (!res.ok) throw new Error(result.error || "The script could not be generated.");
      if (!Array.isArray(result.slides)) throw new Error("The generated script was incomplete.");

      const slides: Slide[] = result.slides.map((s: Record<string, string>, i: number) => ({
        id: `generated-${i + 1}`,
        eyebrow: s.eyebrow || `SLIDE ${i + 1}`,
        title: s.title,
        body: s.body,
        cue: s.cue,
        cueType: "Pause",
        duration: s.duration,
        marker: s.speakerNote || "Speaker note",
        accent: (["petal", "blue", "ink"] as const)[i % 3],
      }));

      onGenerated({
        id: `presentation-${Date.now()}`,
        title: result.deckTitle || title,
        updated: "Just now",
        goal,
        audience,
        durationMinutes: minutes,
        progress: 100,
        slides,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The script could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  const fileComplete = Boolean(file);
  const detailsComplete = Boolean(title && goal && audience);

  return (
    <main className="new-pres">
      <div className="new-pres-head">
        <h1 className="new-pres-h1">New presentation</h1>
        <p className="new-pres-sub">Upload your deck and we&apos;ll generate a presenter script.</p>
      </div>

      <div className="new-pres-form">
        {/* Step 1 – Upload */}
        <div className={`step-card ${fileComplete ? "is-complete" : ""}`}>
          <div className="step-card-head">
            <div className="step-num">{fileComplete ? <Check size={14} /> : "01"}</div>
            <div>
              <p className="step-card-title">Upload your deck</p>
              <p className="step-card-sub">PDF · PPTX · Images</p>
            </div>
            {fileComplete && (
              <span className="step-done-badge"><Check size={11} /> Ready</span>
            )}
          </div>

          <div className="step-card-body">
            {!file ? (
              <button
                className={`drop-zone ${dragging ? "is-dragging" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}
              >
                <span className="drop-zone-icon"><UploadCloud size={17} /></span>
                <span className="drop-zone-label">Drop your file here</span>
                <span className="drop-zone-hint">or click to browse</span>
              </button>
            ) : (
              <div className="uploaded-file">
                <div className="uploaded-file-icon">
                  {file.type.startsWith("image/") ? <FileImage size={18} /> : <FileText size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="uploaded-file-name">{file.name}</p>
                  <p className="uploaded-file-meta">{(file.size / 1024 / 1024).toFixed(1)} MB · ready</p>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                  style={{ border: 0 }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Step 2 – Details */}
        <div className={`step-card ${detailsComplete ? "is-complete" : ""}`}>
          <div className="step-card-head">
            <div className="step-num">{detailsComplete ? <Check size={14} /> : "02"}</div>
            <div>
              <p className="step-card-title">Presentation details</p>
            </div>
            {detailsComplete && (
              <span className="step-done-badge"><Check size={11} /> Ready</span>
            )}
          </div>

          <div className="step-card-body">
            <div className="form-grid">
              <label className="form-field form-field--full">
                <span className="field-label">Title</span>
                <input
                  className="field-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Presentation title"
                />
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Goal</span>
                <textarea
                  className="field-textarea"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="What should this presentation accomplish?"
                  rows={2}
                />
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Audience</span>
                <input
                  className="field-input"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Who's in the room?"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Length</span>
                <div className="field-unit-wrap">
                  <input
                    className="field-input"
                    type="number"
                    min="2"
                    max="60"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                  <span className="field-unit">min</span>
                </div>
              </label>
              <label className="form-field">
                <span className="field-label">Speaking pace</span>
                <div className="field-unit-wrap">
                  <input
                    className="field-input"
                    type="number"
                    min="80"
                    max="220"
                    value={wpm}
                    onChange={(e) => setWpm(Number(e.target.value))}
                  />
                  <span className="field-unit">wpm</span>
                </div>
              </label>
              <label className="form-field form-field--full">
                <span className="field-label">Script depth</span>
                <div className="segmented">
                  {["Full script", "Concise notes", "Cue-led"].map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      className={`seg-opt ${depth === opt ? "is-active" : ""}`}
                      onClick={() => setDepth(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Step 3 – Generate */}
        <div className="step-card gen-card">
          <div className="step-card-head">
            <div className="step-num">03</div>
            <div>
              <p className="step-card-title">Generate script</p>
            </div>
          </div>

          <div className="step-card-body">
            <div className="gen-summary">
              <div className="gen-summary-item">
                <span className="gen-item-label">Word budget</span>
                <strong className="gen-item-val">{wordBudget.toLocaleString()}</strong>
              </div>
              <div className="gen-summary-item">
                <span className="gen-item-label">Target</span>
                <strong className="gen-item-val">{minutes} min</strong>
              </div>
              <div className="gen-summary-item">
                <span className="gen-item-label">Format</span>
                <strong className="gen-item-val">{depth}</strong>
              </div>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={!valid || generating}
              onClick={generate}
            >
              {generating ? (
                <><LoaderCircle className="spin" size={16} /> Generating…</>
              ) : (
                <><Sparkles size={15} /> Generate presentation script</>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
