"use client";

import { AlertCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AiRequestError, generateQuestions, regenerateSupport } from "@/lib/ai/client";
import { makeId } from "@/lib/domain/script";
import type { Project, Slide, SlideScript } from "@/lib/domain/types";
import { usePref } from "@/lib/prefs";
import { ScriptText } from "../presenter/ScriptText";
import { SlideImage } from "../project/SlideImage";
import { Button, IconButton } from "../ui/button";
import { Segmented, Switch, TabPanel, Tabs } from "../ui/controls";
import { Field, Input, Textarea } from "../ui/field";
import { useToast } from "../ui/toast";

type Tab = "slide" | "notes" | "questions" | "preview";

export function Inspector({ project, slide, plannedSeconds, aiEnabled, onScript, onSlide }: {
  project: Project;
  slide: Slide;
  plannedSeconds: number;
  aiEnabled: boolean;
  onScript: (patch: Partial<SlideScript>) => void;
  onSlide: (patch: Partial<Pick<Slide, "optional" | "targetSeconds" | "notes">>) => void;
}) {
  const [tab, setTab] = useState<Tab>("slide");
  const [busy, setBusy] = useState<"notes" | "questions" | null>(null);
  const [prefs] = usePref("presenter");
  const [previewMode, setPreviewMode] = useState(prefs.mode);
  const toast = useToast();
  const script = slide.script;

  async function refreshNotes() {
    setBusy("notes");
    try {
      const result = await regenerateSupport(project, slide);
      onScript({ concise: result.concise, keywords: result.keywords, recovery: result.recovery, transition: result.transition });
      toast("Notes updated from the current script");
    } catch (error) {
      toast({ message: error instanceof AiRequestError ? error.message : "Notes couldn't be updated.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function suggestQuestions() {
    setBusy("questions");
    try {
      const result = await generateQuestions(project, slide);
      const existing = new Set(script.questions.map((question) => question.question.toLowerCase()));
      const added = result.questions.filter((question) => !existing.has(question.question.toLowerCase())).map((question) => ({ id: makeId("q"), ...question }));
      onScript({ questions: [...script.questions, ...added] });
      toast(added.length ? `Added ${added.length} question${added.length === 1 ? "" : "s"}` : "No new questions to add");
    } catch (error) {
      toast({ message: error instanceof AiRequestError ? error.message : "Questions couldn't be generated.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const analysis = slide.analysis;
  const warnings = slide.warnings.filter((warning) => warning.kind !== "sparse-text");

  return (
    <aside className="inspector" aria-label="Slide details">
      <Tabs
        label="Slide details"
        idPrefix="inspector"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "slide", label: "Slide" },
          { value: "notes", label: "Notes" },
          { value: "questions", label: "Q&A", badge: script.questions.length || undefined },
          { value: "preview", label: "Preview" },
        ]}
      />

      {tab === "slide" && (
        <TabPanel idPrefix="inspector" value="slide" className="inspector__panel">
          <SlideImage slide={slide} aspectRatio={project.aspectRatio} priority />
          {analysis ? (
            <dl className="inspector__facts">
              <div><dt>Main point</dt><dd>{analysis.mainPoint}</dd></div>
              {analysis.visualSummary && <div><dt>What the audience sees</dt><dd>{analysis.visualSummary}</dd></div>}
              {analysis.elements.length > 0 && (
                <div><dt>Worth pointing to</dt><dd><ul className="inspector__list">{analysis.elements.map((element) => <li key={element.label}>{element.label} <span className="faint">· {element.region}</span></li>)}</ul></dd></div>
              )}
              {analysis.uncertain.length > 0 && (
                <div><dt>Couldn&apos;t read clearly</dt><dd><ul className="inspector__list">{analysis.uncertain.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
              )}
            </dl>
          ) : (
            <p className="inspector__muted">No slide analysis yet. It runs when a script is written.</p>
          )}
          {warnings.length > 0 && warnings.map((warning) => (
            <p key={warning.message} className="inspector__warning"><AlertCircle aria-hidden="true" /> {warning.message}</p>
          ))}

          <div className="inspector__group">
            <h3 className="inspector__heading">Timing</h3>
            <Field label="Target time for this slide" hint={slide.targetSeconds == null ? `Planned automatically: about ${plannedSeconds} seconds.` : "Set by you. Clear it to go back to automatic."}>
              <Input
                type="number"
                inputMode="numeric"
                unit="sec"
                min={0}
                max={1800}
                placeholder={String(plannedSeconds)}
                value={slide.targetSeconds ?? ""}
                onChange={(event) => onSlide({ targetSeconds: event.target.value === "" ? null : Math.max(0, Math.min(1800, Number(event.target.value))) })}
              />
            </Field>
            <Switch checked={slide.optional} onChange={(optional) => onSlide({ optional })} label="Optional slide" description="Skippable if time is short. Excluded from the time plan." />
          </div>

          <div className="inspector__group">
            <h3 className="inspector__heading">Deck notes</h3>
            <Textarea rows={3} aria-label="Speaker notes from the deck" value={slide.notes} placeholder="Speaker notes from your deck, or context the AI should know about this slide." onChange={(event) => onSlide({ notes: event.target.value })} />
          </div>
        </TabPanel>
      )}

      {tab === "notes" && (
        <TabPanel idPrefix="inspector" value="notes" className="inspector__panel">
          <p className="inspector__muted">Private support for this slide. Presenter shows these in short-notes and keyword modes, and when you lose your place.</p>
          <Field label="Purpose" hint="Why this slide is here, in one sentence.">
            <Input value={script.purpose} onChange={(event) => onScript({ purpose: event.target.value })} />
          </Field>
          <Field label="Short version" hint="What to say when time is short.">
            <Textarea rows={3} value={script.concise} onChange={(event) => onScript({ concise: event.target.value })} />
          </Field>
          <Field label="Keywords" hint="Separate with commas.">
            <Input value={script.keywords.join(", ")} onChange={(event) => onScript({ keywords: event.target.value.split(",").map((keyword) => keyword.trimStart()).filter((keyword, index, all) => keyword || index === all.length - 1) })} onBlur={() => onScript({ keywords: script.keywords.map((keyword) => keyword.trim()).filter(Boolean) })} />
          </Field>
          <Field label="If you lose your place" hint="A calm line that restates the point.">
            <Textarea rows={2} value={script.recovery} onChange={(event) => onScript({ recovery: event.target.value })} />
          </Field>
          <Field label="Transition to next slide">
            <Textarea rows={2} value={script.transition} onChange={(event) => onScript({ transition: event.target.value })} />
          </Field>
          {aiEnabled && (
            <Button variant="secondary" size="sm" icon={<RefreshCw />} loading={busy === "notes"} onClick={refreshNotes}>Update notes from script</Button>
          )}
        </TabPanel>
      )}

      {tab === "questions" && (
        <TabPanel idPrefix="inspector" value="questions" className="inspector__panel">
          <p className="inspector__muted">Questions this audience might ask about this slide, with answers you&apos;re comfortable giving.</p>
          {script.questions.map((question, index) => (
            <div key={question.id} className="qa-item">
              <div className="qa-item__head">
                <span className="qa-item__label">Question {index + 1}</span>
                <IconButton label="Remove question" size="sm" tooltip={false} onClick={() => onScript({ questions: script.questions.filter((item) => item.id !== question.id) })}><Trash2 /></IconButton>
              </div>
              <Textarea rows={2} aria-label={`Question ${index + 1}`} value={question.question} onChange={(event) => onScript({ questions: script.questions.map((item) => item.id === question.id ? { ...item, question: event.target.value } : item) })} />
              <Textarea rows={3} aria-label={`Answer ${index + 1}`} placeholder="Your answer" value={question.answer} onChange={(event) => onScript({ questions: script.questions.map((item) => item.id === question.id ? { ...item, answer: event.target.value } : item) })} />
            </div>
          ))}
          <div className="inspector__actions">
            <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => onScript({ questions: [...script.questions, { id: makeId("q"), question: "", answer: "" }] })}>Add question</Button>
            {aiEnabled && <Button variant="ghost" size="sm" loading={busy === "questions"} onClick={suggestQuestions}>Suggest questions</Button>}
          </div>
        </TabPanel>
      )}

      {tab === "preview" && (
        <TabPanel idPrefix="inspector" value="preview" className="inspector__panel">
          <Segmented size="sm" label="Reading mode" value={previewMode} onChange={setPreviewMode} options={[{ value: "full", label: "Script" }, { value: "notes", label: "Short" }, { value: "keywords", label: "Keywords" }, { value: "cues", label: "Cues" }]} />
          <div className="presenter-preview theme-dark">
            <ScriptText script={script} mode={previewMode} showCues={prefs.showCues} />
          </div>
          <p className="inspector__muted">How this slide reads in Presenter at a smaller size.</p>
        </TabPanel>
      )}
    </aside>
  );
}
