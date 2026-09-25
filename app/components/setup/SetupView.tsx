"use client";

import { ArrowRight, Check, CircleAlert, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAiStatus } from "@/lib/ai/client";
import { useOrchestrator } from "@/lib/ai/orchestrator";
import { formatDuration, pluralize } from "@/lib/domain/format";
import { clampBrief, hasScript, LIMITS, planPresentation, planSummary } from "@/lib/domain/planner";
import type { Brief, DeliveryStyle, Project } from "@/lib/domain/types";
import { setPref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { Button, ButtonLink } from "../ui/button";
import { Callout, Segmented, Spinner, Switch } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { Field, Input, Select, Textarea } from "../ui/field";
import { RevealWords, RollingText } from "../ui/motion";
import { useToast } from "../ui/toast";
import { GeneratingView } from "./GeneratingView";
import { RebalanceDialog } from "./RebalanceDialog";
import { SlideReview } from "./SlideReview";

const STYLES: { value: DeliveryStyle; label: string; description: string }[] = [
  { value: "conversational", label: "Conversational", description: "Plain, warm, like talking to a colleague" },
  { value: "measured", label: "Measured", description: "Calm and deliberate, with room for pauses" },
  { value: "concise", label: "Concise", description: "Short sentences, no preamble" },
  { value: "energetic", label: "Energetic", description: "Forward momentum without hype" },
  { value: "technical", label: "Technical", description: "Precise terms, briefly defined" },
  { value: "executive", label: "Executive", description: "Conclusion first, then evidence" },
];

const PACES = [
  { value: 115, label: "Relaxed" },
  { value: 130, label: "Natural" },
  { value: 150, label: "Brisk" },
];

type TextField = "goal" | "audience" | "keyMessage";

export function SetupView({ project }: { project: Project }) {
  const router = useRouter();
  const toast = useToast();
  const { update } = useProjects();
  const orchestrator = useOrchestrator();
  const aiStatus = useAiStatus();

  const [brief, setBrief] = useState<Brief>(project.brief);
  const [title, setTitle] = useState(project.title);
  const [attempted, setAttempted] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [suggested, setSuggested] = useState<Partial<Record<TextField, boolean>>>({});
  const touched = useRef(new Set<string>());
  const saveTimer = useRef<number | undefined>(undefined);
  const pending = useRef<{ brief: Brief; title: string } | null>(null);

  const scripted = hasScript(project);
  const plan = useMemo(() => planPresentation(brief, project.slides), [brief, project.slides]);
  const running = project.generation.status === "running";
  const aiReady = aiStatus ? aiStatus.provider !== "none" : null;

  // ── Persistence (debounced; flushed on unmount) ──────────────────────────
  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    const next = pending.current;
    if (!next) return Promise.resolve();
    pending.current = null;
    return update(project.id, (current) => ({ ...current, title: next.title.trim() || current.title, brief: clampBrief(next.brief) })).then(() => undefined);
  }, [project.id, update]);

  const schedule = useCallback((nextBrief: Brief, nextTitle: string) => {
    pending.current = { brief: nextBrief, title: nextTitle };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), 450);
  }, [flush]);

  useEffect(() => () => { void flush(); }, [flush]);

  const patch = useCallback((values: Partial<Brief>, fromUser = true) => {
    if (fromUser) Object.keys(values).forEach((key) => touched.current.add(key));
    setBrief((current) => {
      const next = { ...current, ...values };
      schedule(next, title);
      return next;
    });
    if (fromUser) setSuggested((current) => {
      const next = { ...current };
      for (const key of Object.keys(values)) delete next[key as TextField];
      return next;
    });
  }, [schedule, title]);

  // ── Background analysis and suggestions ──────────────────────────────────
  useEffect(() => {
    if (aiReady && project.analysis.status === "idle" && !scripted) void orchestrator.analyze(project.id);
  }, [aiReady, orchestrator, project.analysis.status, project.id, scripted]);

  useEffect(() => {
    const context = project.context;
    if (!context) return;
    const fills: Partial<Brief> = {};
    const marks: Partial<Record<TextField, boolean>> = {};
    const candidates: [TextField, string][] = [["goal", context.suggestedGoal], ["audience", context.suggestedAudience], ["keyMessage", context.suggestedKeyMessage]];
    for (const [field, value] of candidates) {
      if (value && !brief[field].trim() && !touched.current.has(field)) {
        fills[field] = value;
        marks[field] = true;
      }
    }
    if (Object.keys(fills).length) {
      // Suggestions arrive asynchronously from analysis; filling empty fields once is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      patch(fills, false);
      setSuggested((current) => ({ ...current, ...marks }));
    }
    // Only react to newly arrived context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.context]);

  // ── Generation lifecycle ─────────────────────────────────────────────────
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running && project.generation.status === "idle" && project.status === "ready") {
      toast("Your script is ready");
      router.push(`/p/${project.id}/edit`);
    }
    wasRunning.current = running;
  }, [running, project.generation.status, project.status, project.id, router, toast]);

  const errors = {
    goal: !brief.goal.trim() ? "Add a goal so the script knows what it's working toward." : null,
    audience: !brief.audience.trim() ? "Add who you're speaking to." : null,
  };
  const valid = !errors.goal && !errors.audience && plan.includedSlides > 0;

  async function startGeneration() {
    setAttempted(true);
    if (!valid || !aiReady) return;
    await flush();
    setPref("defaultBrief", { minutes: brief.minutes, qaMinutes: brief.qaMinutes, wpm: brief.wpm, style: brief.style, depth: brief.depth, cueDensity: brief.cueDensity, includeQuestions: brief.includeQuestions });
    orchestrator.generate(project.id).catch(() => { /* surfaced through project.generation */ });
  }

  const outOfDate = scripted && project.generatedWith && (
    project.generatedWith.minutes !== brief.minutes || project.generatedWith.qaMinutes !== brief.qaMinutes ||
    project.generatedWith.wpm !== brief.wpm || project.generatedWith.depth !== brief.depth
  );

  async function keepWording() {
    await flush();
    await update(project.id, (current) => ({ ...current, generatedWith: { minutes: current.brief.minutes, qaMinutes: current.brief.qaMinutes, wpm: current.brief.wpm, depth: current.brief.depth } }));
    toast("Saved. Timing estimates and teleprompter pace now use the new settings.");
  }

  if (running) return <GeneratingView project={project} onCancel={() => orchestrator.cancel(project.id)} />;

  const failed = project.generation.status === "failed" ? project.generation.error : null;

  return (
    <div className="setup">
      <header className="setup__header">
        <p className="eyebrow">{scripted ? "Presentation setup" : "Step 2 of 2"}</p>
        <h1 className="page-title">{scripted ? "Setup" : "Tell Cueframe about your talk"}</h1>
        <p className="page-lede">
          {scripted
            ? "Change the brief and timing. Your current script stays as it is unless you choose to rebalance it or write a new draft."
            : "A few details shape the script: what you want to achieve, who's listening, and how long you have."}
        </p>
      </header>

      <div className="setup__layout">
        <div className="setup__main">
          <section className="setup-section" aria-labelledby="setup-slides">
            <div className="setup-section__head">
              <h2 id="setup-slides" className="section-title">Slides</h2>
              <p className="setup-section__meta">{pluralize(project.slides.length, "slide")} from {project.source.fileName}</p>
            </div>
            <SlideReview project={project} />
          </section>

          <section className="setup-section" aria-labelledby="setup-about">
            <div className="setup-section__head">
              <h2 id="setup-about" className="section-title">About this presentation</h2>
              <AnalysisStatus project={project} aiReady={aiReady} onRetry={() => orchestrator.analyze(project.id)} />
            </div>
            {project.context?.summary && (
              <div className="deck-understanding">
                <Sparkles aria-hidden="true" />
                <p><span className="deck-understanding__label">What Cueframe sees in your slides:</span> <RevealWords text={project.context.summary} /></p>
              </div>
            )}
            <div className="form-stack">
              <Field
                label="Title"
                action={project.context?.title && project.context.title !== title ? (
                  <button type="button" className="suggest-link" onClick={() => { setTitle(project.context!.title); schedule(brief, project.context!.title); }}>
                    Use “{project.context.title}”
                  </button>
                ) : undefined}
              >
                <Input value={title} maxLength={160} onChange={(event) => { setTitle(event.target.value); schedule(brief, event.target.value); }} />
              </Field>
              <Field
                label="Goal"
                className={suggested.goal ? "field--suggested" : undefined}
                hint={suggested.goal ? "Suggested from your slides. Edit it so it's in your words." : "What should this presentation achieve? For example, “Get approval for a one-month pilot.”"}
                error={attempted ? errors.goal : null}
              >
                <Textarea rows={2} value={brief.goal} maxLength={600} onChange={(event) => patch({ goal: event.target.value })} placeholder="What do you want the audience to understand, decide, or do?" />
              </Field>
              <Field
                label="Audience"
                className={suggested.audience ? "field--suggested" : undefined}
                hint={suggested.audience ? "Suggested from your slides." : "Who's in the room, and how much do they already know?"}
                error={attempted ? errors.audience : null}
              >
                <Input value={brief.audience} maxLength={400} onChange={(event) => patch({ audience: event.target.value })} placeholder="e.g. Product leads who know the roadmap but not the research" />
              </Field>
              <Field label="Key message" optional className={suggested.keyMessage ? "field--suggested" : undefined} hint={suggested.keyMessage ? "Suggested from your slides." : "The one thing they should remember."}>
                <Input value={brief.keyMessage} maxLength={600} onChange={(event) => patch({ keyMessage: event.target.value })} />
              </Field>
            </div>
          </section>

          <section className="setup-section" aria-labelledby="setup-timing">
            <div className="setup-section__head">
              <h2 id="setup-timing" className="section-title">Timing and delivery</h2>
            </div>
            <div className="form-grid">
              <Field label="Total length">
                <Input type="number" inputMode="numeric" unit="min" min={LIMITS.minutes.min} max={LIMITS.minutes.max} value={brief.minutes} onChange={(event) => patch({ minutes: Number(event.target.value) })} onBlur={() => patch(clampBrief(brief), false)} />
              </Field>
              <Field label="Time for questions" optional>
                <Input type="number" inputMode="numeric" unit="min" min={0} max={LIMITS.qaMinutes.max} value={brief.qaMinutes} onChange={(event) => patch({ qaMinutes: Number(event.target.value) })} onBlur={() => patch(clampBrief(brief), false)} />
              </Field>
              <Field label="Speaking pace" hint="Most people speak 120–150 words a minute when presenting." className="form-grid__full">
                <div className="pace-row">
                  <Segmented
                    label="Speaking pace preset"
                    value={String(PACES.find((pace) => pace.value === brief.wpm)?.value ?? "custom")}
                    onChange={(value) => value !== "custom" && patch({ wpm: Number(value) })}
                    options={[...PACES.map((pace) => ({ value: String(pace.value), label: <>{pace.label} <span className="faint tabular">{pace.value}</span></> })), ...(PACES.some((pace) => pace.value === brief.wpm) ? [] : [{ value: "custom", label: "Custom" }])]}
                  />
                  <Input className="pace-row__input" type="number" inputMode="numeric" unit="wpm" aria-label="Words per minute" min={LIMITS.wpm.min} max={LIMITS.wpm.max} value={brief.wpm} onChange={(event) => patch({ wpm: Number(event.target.value) })} onBlur={() => patch(clampBrief(brief), false)} />
                </div>
              </Field>
              <Field label="Delivery style" className="form-grid__full" hint={STYLES.find((style) => style.value === brief.style)?.description}>
                <Select value={brief.style} onChange={(event) => patch({ style: event.target.value as DeliveryStyle })}>
                  {STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                </Select>
              </Field>
              <Field label="Script depth" className="form-grid__full" hint={brief.depth === "full" ? "Complete sentences you can read aloud." : brief.depth === "notes" ? "Short prompts you expand in your own words." : "A few keywords per slide to jog your memory."}>
                <Segmented label="Script depth" value={brief.depth} onChange={(depth) => patch({ depth })} options={[{ value: "full", label: "Full script" }, { value: "notes", label: "Concise notes" }, { value: "cues", label: "Keywords" }]} />
              </Field>
              <Field label="Delivery cues" className="form-grid__full" hint="Private reminders like “pause here” or “point to the chart”. Only you see them.">
                <Segmented label="Delivery cues" value={brief.cueDensity} onChange={(cueDensity) => patch({ cueDensity })} options={[{ value: "none", label: "None" }, { value: "light", label: "A few" }, { value: "detailed", label: "Detailed" }]} />
              </Field>
              <div className="form-grid__full">
                <Switch checked={brief.includeQuestions} onChange={(includeQuestions) => patch({ includeQuestions })} label="Prepare for likely questions" description="Adds a few questions the audience might ask, with short answers." />
              </div>
            </div>

            <details className="advanced">
              <summary>More context <span className="faint">optional</span></summary>
              <div className="form-stack">
                <Field label="Must include" hint="Facts, examples, or a call to action the script should cover.">
                  <Textarea rows={3} value={brief.mustInclude} maxLength={1500} onChange={(event) => patch({ mustInclude: event.target.value })} />
                </Field>
                <Field label="Avoid" hint="Topics, claims, or phrasing to leave out.">
                  <Textarea rows={2} value={brief.avoid} maxLength={800} onChange={(event) => patch({ avoid: event.target.value })} />
                </Field>
                <Field label="Your role" hint="Your relationship to the audience, e.g. “new team lead presenting to peers”.">
                  <Input value={brief.presenterRole} maxLength={300} onChange={(event) => patch({ presenterRole: event.target.value })} />
                </Field>
              </div>
            </details>
          </section>
        </div>

        <aside className="setup__aside" aria-label="Plan">
          <div className="plan-card">
            <h2 className="plan-card__title">Your plan</h2>
            <dl className="plan-card__rows">
              <div><dt>Speaking time</dt><dd className="tabular"><RollingText value={formatDuration(plan.speakingSeconds)} />{brief.qaMinutes > 0 && <span className="faint"> + {brief.qaMinutes} min Q&amp;A</span>}</dd></div>
              <div><dt>Spoken words</dt><dd className="tabular"><RollingText value={`~${plan.range[0].toLocaleString()}–${plan.range[1].toLocaleString()}`} /></dd></div>
              <div><dt>Per slide</dt><dd className="tabular"><RollingText value={plan.includedSlides ? `~${Math.round(plan.usableWords / plan.includedSlides)} words` : "—"} /></dd></div>
              <div><dt>Slides</dt><dd className="tabular"><RollingText value={`${plan.includedSlides} included`} />{project.slides.length > plan.includedSlides && <span className="faint"> · {project.slides.length - plan.includedSlides} optional</span>}</dd></div>
            </dl>
            <p className="plan-card__note">Longer, denser slides get more time; title slides get less. You can adjust any slide later.</p>
            {plan.warnings.map((warning) => (
              <p key={warning.message} className={`plan-card__warning plan-card__warning--${warning.level}`}>
                <CircleAlert aria-hidden="true" /> {warning.message}
              </p>
            ))}

            {outOfDate && (
              <Callout tone="warn" title="Your script was written for different timing">
                <p>It was planned for {project.generatedWith!.minutes} min at {project.generatedWith!.wpm} wpm{project.generatedWith!.depth !== brief.depth ? " with a different depth" : ""}.</p>
                <div className="plan-card__choices">
                  <Button size="sm" variant="primary" onClick={async () => { await flush(); setRebalancing(true); }}>Rebalance script…</Button>
                  <Button size="sm" variant="ghost" onClick={keepWording}>Keep wording</Button>
                </div>
              </Callout>
            )}

            {failed && (
              <Callout tone="error" title="The script wasn't finished">{failed}</Callout>
            )}
            {aiStatus?.provider === "demo" && (
              <Callout title="Demo mode">Scripts are assembled from your slide text so you can try everything. Set OPENAI_API_KEY on the server for real AI writing.</Callout>
            )}
            {aiReady === false && (
              <Callout tone="warn" title="AI isn't set up">This server doesn&apos;t have an AI key yet, so scripts can&apos;t be written. You can still write your own script in the editor.</Callout>
            )}

            <div className="plan-card__summary tabular">{planSummary(brief, plan)}</div>

            {scripted ? (
              <div className="plan-card__actions">
                <ButtonLink href={`/p/${project.id}/edit`} variant="primary" block onClick={() => void flush()} trailing={<ArrowRight />}>Back to script</ButtonLink>
                <Button variant="secondary" block disabled={!aiReady} onClick={() => { setAttempted(true); if (valid) setConfirmRegenerate(true); }}>Write a new draft…</Button>
              </div>
            ) : (
              <div className="plan-card__actions">
                <Button variant="accent" size="lg" block disabled={aiReady === false} loading={aiReady === null} icon={<Sparkles />} onClick={startGeneration}>
                  {failed ? "Try again" : "Write my script"}
                </Button>
                {attempted && !valid && <p className="plan-card__invalid" role="alert">Add a goal and audience to continue.</p>}
                <ButtonLink href={`/p/${project.id}/edit`} variant="ghost" block onClick={() => void flush()}>I&apos;ll write it myself</ButtonLink>
              </div>
            )}
            <p className="plan-card__privacy">Writing a script sends slide images, slide text, and this brief to the AI service. Everything else stays in this browser.</p>
          </div>
        </aside>
      </div>

      <Dialog
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        title="Write a new draft?"
        description="This replaces the script for every slide, including your edits. The current version is saved in History so you can restore it."
        size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>Cancel</Button>
          <Button variant="primary" icon={<Sparkles />} onClick={() => { setConfirmRegenerate(false); void startGeneration(); }}>Write new draft</Button>
        </>}
      />
      {rebalancing && <RebalanceDialog project={project} onClose={() => setRebalancing(false)} />}
    </div>
  );
}

function AnalysisStatus({ project, aiReady, onRetry }: { project: Project; aiReady: boolean | null; onRetry: () => void }) {
  if (!aiReady || hasScript(project)) return null;
  const { status } = project.analysis;
  if (status === "running" || status === "idle") return <p className="analysis-status" role="status"><Spinner size={14} label="" /> <span className="shimmer-text">Reading your slides…</span></p>;
  if (status === "failed") return <p className="analysis-status">Couldn&apos;t read the slides for suggestions. <button type="button" className="suggest-link" onClick={onRetry}>Retry</button></p>;
  return <p className="analysis-status analysis-status--done"><Check aria-hidden="true" /> Read {pluralize(project.slides.filter((slide) => slide.analysis).length, "slide")}</p>;
}
