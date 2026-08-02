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

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    if (!title) setTitle(nextFile.name.replace(/\.(pdf|pptx?|png|jpe?g|webp)$/i, "").replace(/[-_]+/g, " "));
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
      const response = await fetch("/api/generate-script", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The script could not be generated.");

      const slides: Slide[] = result.slides.map((slide: Record<string, string>, index: number) => ({
        id: `generated-${index + 1}`,
        eyebrow: slide.eyebrow || `SLIDE ${index + 1}`,
        title: slide.title,
        body: slide.body,
        cue: slide.cue,
        cueType: "Pause",
        duration: slide.duration,
        marker: slide.speakerNote || "Speaker note",
        accent: (["petal", "blue", "ink"] as const)[index % 3],
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
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "The script could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="create-workspace">
      <header className="create-header">
        <div>
          <h1>New presentation</h1>
        </div>
        <div className="create-progress glass-panel" aria-label="3 steps"><strong>3</strong></div>
      </header>

      <section className={`flow-section glass-panel ${file ? "is-complete" : ""}`}>
        <div className="step-number">01</div>
        <div className="flow-section__body">
          <div className="flow-section__heading">
            <div><h2>Upload</h2><p>PDF · PPTX · Images</p></div>
            {file && <span className="complete-chip"><Check size={13} /> Ready</span>}
          </div>
          {!file ? (
            <button
              className={`drop-zone ${dragging ? "is-dragging" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
            >
              <span className="drop-zone__orb"><UploadCloud /></span>
              <strong>Upload</strong>
              <span>PDF · PPTX · Images</span>
            </button>
          ) : (
            <div className="uploaded-file">
              <div className="uploaded-file__icon">{file.type.startsWith("image/") ? <FileImage /> : <FileText />}</div>
              <div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to analyze</span></div>
              <div className="mini-slide-stack" aria-hidden="true"><i /><i /><i /></div>
              <button className="icon-button" onClick={() => setFile(null)} aria-label="Remove uploaded file"><X size={17} /></button>
            </div>
          )}
          <input ref={inputRef} hidden type="file" accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </div>
      </section>

      <section className={`flow-section glass-panel ${title && goal && audience ? "is-complete" : ""}`}>
        <div className="step-number">02</div>
        <div className="flow-section__body">
          <div className="flow-section__heading">
            <div><h2>Details</h2></div>
          </div>
          <div className="form-grid">
            <label className="field field--wide"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Presentation title" /></label>
            <label className="field field--wide"><span>Goal</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What should it accomplish?" rows={3} /></label>
            <label className="field field--wide"><span>Audience</span><input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Who is in the room?" /></label>
            <label className="field"><span>Length</span><div className="field-with-unit"><input type="number" min="2" max="60" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /><em>min</em></div></label>
            <label className="field"><span>Speaking pace</span><div className="field-with-unit"><input type="number" min="80" max="200" value={wpm} onChange={(event) => setWpm(Number(event.target.value))} /><em>wpm</em></div></label>
            <label className="field field--wide"><span>Detail</span><div className="segmented-control">{["Full script", "Concise notes", "Cue-led"].map((option) => <button type="button" className={depth === option ? "is-active" : ""} onClick={() => setDepth(option)} key={option}>{option}</button>)}</div></label>
          </div>
        </div>
      </section>

      <section className="flow-section flow-section--final glass-panel">
        <div className="step-number">03</div>
        <div className="flow-section__body">
          <div className="generation-summary">
            <div><span>Estimated script</span><strong>{wordBudget.toLocaleString()} words</strong></div>
            <div><span>Target delivery</span><strong>{minutes} minutes</strong></div>
            <div><span>Format</span><strong>{depth}</strong></div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="generate-button" disabled={!valid || generating} onClick={generate}>
            {generating ? <><LoaderCircle className="spin" /> Generating…</> : <><Sparkles /> Generate</>}
          </button>
        </div>
      </section>
    </main>
  );
}
