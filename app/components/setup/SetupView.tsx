"use client";

import { ArrowRight, Ban, Briefcase, CircleAlert, Cpu, Hourglass, ListChecks, MessageCircle, Quote, Scissors, Sparkles, Target, UserRound, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAiStatus } from "@/lib/ai/client";
import { useOrchestrator } from "@/lib/ai/orchestrator";
import { fileBaseName, formatDuration, pluralize } from "@/lib/domain/format";
import { clampBrief, hasScript, LIMITS, planPresentation, planSummary } from "@/lib/domain/planner";
import type { Brief, DeliveryStyle, Project, ScriptDepth } from "@/lib/domain/types";
import { setPref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { Button, ButtonLink } from "../ui/button";
import { Callout, Segmented, Slider, Spinner } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { RollingText } from "../ui/motion";
import { useToast } from "../ui/toast";
import { BriefRow, ChoiceCards, ExtraFields, LengthPicker, PaceVisual, ShapeVisual, VoiceSample, type Chip } from "./BriefControls";
import { GeneratingView } from "./GeneratingView";
import { RebalanceDialog } from "./RebalanceDialog";
import { SlideReview } from "./SlideReview";

const STYLES: { value: DeliveryStyle; label: string; description: string; sample: string; icon: ReactNode }[] = [
  { value: "conversational", label: "Conversational", description: "Warm, like talking to a colleague", sample: "So here's what we found, and why I think it matters for you.", icon: <MessageCircle /> },
  { value: "measured", label: "Measured", description: "Calm, with room for pauses", sample: "Let's take this one step at a time, starting with what we know.", icon: <Hourglass /> },
  { value: "concise", label: "Concise", description: "Short sentences, no preamble", sample: "Three findings. One decision. Here's the first.", icon: <Scissors /> },
  { value: "energetic", label: "Energetic", description: "Momentum without hype", sample: "This is the part I'm most excited to show you, because it works.", icon: <Zap /> },
  { value: "technical", label: "Technical", description: "Precise terms, briefly defined", sample: "Latency drops because requests are batched, which means fewer round trips.", icon: <Cpu /> },
  { value: "executive", label: "Executive", description: "Conclusion first, then evidence", sample: "The bottom line is we're on track, and here's the evidence.", icon: <Briefcase /> },
];

const PACES = [
  { value: 115, label: "Relaxed" },
  { value: 130, label: "Natural" },
  { value: 150, label: "Brisk" },
];

const DEPTHS: { value: ScriptDepth; label: string; description: string }[] = [
  { value: "full", label: "Full script", description: "Complete sentences to read aloud" },
  { value: "notes", label: "Concise notes", description: "Short prompts you expand" },
  { value: "cues", label: "Keywords", description: "A few words to jog memory" },
];

const CUE_COUNT: Record<Brief["cueDensity"], number> = { none: 0, light: 1, detailed: 3 };

const GOAL_STARTERS: Chip[] = [
  { label: "Get approval for…", value: "Get approval for " },
  { label: "Update them on…", value: "Update them on " },
  { label: "Teach them how to…", value: "Teach them how to " },
  { label: "Convince them to…", value: "Convince them to " },
];

const AUDIENCES: Chip[] = [
  { label: "Classmates", value: "Classmates and instructors" },
  { label: "Project sponsor", value: "Project sponsor and reviewers" },
  { label: "Executives", value: "Executives who want the bottom line" },
  { label: "Technical team", value: "A technical team who knows the details" },
  { label: "Clients", value: "Clients new to the project" },
  { label: "General", value: "A general audience" },
];

const EXTRAS = [
  { key: "mustInclude", label: "Must include", add: "Must include", icon: <ListChecks />, placeholder: "Facts, examples, or a call to action to cover", maxLength: 1500 },
  { key: "avoid", label: "Avoid", add: "Things to avoid", icon: <Ban />, placeholder: "Topics, claims, or phrasing to leave out", maxLength: 800 },
  { key: "presenterRole", label: "Your role", add: "Your role", icon: <UserRound />, placeholder: "e.g. New team lead presenting to peers", maxLength: 300 },
];

type TextField = "goal" | "audience" | "keyMessage";
type Suggestible = TextField | "title";

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
  const [suggested, setSuggested] = useState<Partial<Record<Suggestible, boolean>>>({});
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
    const marks: Partial<Record<Suggestible, boolean>> = {};
    const candidates: [TextField, string][] = [["goal", context.suggestedGoal], ["audience", context.suggestedAudience], ["keyMessage", context.suggestedKeyMessage]];
    for (const [field, value] of candidates) {
      if (value && !brief[field].trim() && !touched.current.has(field)) {
        fills[field] = value;
        marks[field] = true;
      }
    }
    // The AI's title replaces the one taken from the file name, never one the presenter chose.
    const imported = [fileBaseName(project.source.fileName), "Untitled presentation"];
    const nextTitle = context.title && !touched.current.has("title") && imported.includes(title.trim()) ? context.title : title;
    if (nextTitle !== title) {
      marks.title = true;
      setTitle(nextTitle);
    }
    if (Object.keys(fills).length || nextTitle !== title) {
      // Suggestions arrive asynchronously from analysis; filling fields once is intentional.
      setBrief((current) => {
        const next = { ...current, ...fills };
        schedule(next, nextTitle);
        return next;
      });
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

  // Nothing here is required: a blank goal or audience is written with these defaults.
  const defaults = {
    goal: `Help the audience understand ${title.trim() || "this presentation"}`,
    audience: "A general audience",
  };
  const currentStyle = STYLES.find((style) => style.value === brief.style) ?? STYLES[0];
  const valid = plan.includedSlides > 0;

  async function startGeneration() {
    setAttempted(true);
    if (!valid || !aiReady) return;
    if (!brief.goal.trim() || !brief.audience.trim()) {
      const filled = { ...brief, goal: brief.goal.trim() || defaults.goal, audience: brief.audience.trim() || defaults.audience };
      setBrief(filled);
      schedule(filled, title);
    }
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

  if (running) return <GeneratingView onCancel={() => orchestrator.cancel(project.id)} />;

  const failed = project.generation.status === "failed" ? project.generation.error : null;

  return (
    <div className="setup">
      <header className="setup__header">
        <h1 className="page-title">Setup</h1>
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
              <h2 id="setup-about" className="section-title">About your talk</h2>
              <AnalysisStatus project={project} aiReady={aiReady} onRetry={() => orchestrator.analyze(project.id)} />
            </div>
            <div className="brief-card">
              <div className="brief-title" data-suggested={suggested.title || undefined}>
                <label htmlFor="brief-title" className="brief-title__label">Title{suggested.title && <span className="brief-tag brief-tag--ai"><Sparkles aria-hidden="true" />Suggested</span>}</label>
                <input
                  id="brief-title"
                  className="brief-title__input"
                  value={title}
                  maxLength={160}
                  placeholder={fileBaseName(project.source.fileName)}
                  onChange={(event) => {
                    touched.current.add("title");
                    setSuggested((current) => ({ ...current, title: false }));
                    setTitle(event.target.value);
                    schedule(brief, event.target.value);
                  }}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                />
              </div>
              <BriefRow
                icon={<Target />}
                label="Goal"
                value={brief.goal}
                maxLength={600}
                fallback={defaults.goal}
                suggested={suggested.goal}
                starters={GOAL_STARTERS}
                onChange={(goal) => patch({ goal })}
              />
              <BriefRow
                icon={<Users />}
                label="Audience"
                value={brief.audience}
                maxLength={400}
                fallback={defaults.audience}
                suggested={suggested.audience}
                chips={AUDIENCES}
                onChange={(audience) => patch({ audience })}
              />
              <BriefRow
                icon={<Quote />}
                label="Key message"
                value={brief.keyMessage}
                maxLength={600}
                placeholder="The one thing they should remember (optional)"
                suggested={suggested.keyMessage}
                onChange={(keyMessage) => patch({ keyMessage })}
              />
            </div>
            <ExtraFields
              fields={EXTRAS}
              values={{ mustInclude: brief.mustInclude, avoid: brief.avoid, presenterRole: brief.presenterRole }}
              onChange={(key, value) => patch({ [key]: value })}
            />
          </section>

          <section className="setup-section" aria-labelledby="setup-timing">
            <div className="setup-section__head">
              <h2 id="setup-timing" className="section-title">How you&apos;ll deliver it</h2>
            </div>
            <div className="delivery-grid">
              <div className="delivery-block">
                <h3 className="delivery-block__title">Length</h3>
                <LengthPicker
                  minutes={brief.minutes}
                  min={LIMITS.minutes.min}
                  max={LIMITS.minutes.max}
                  onChange={(minutes) => patch({ minutes })}
                  perSlide={plan.includedSlides ? formatDuration(plan.speakingSeconds / plan.includedSlides) : null}
                />
              </div>
              <div className="delivery-block">
                <h3 className="delivery-block__title">Speaking pace</h3>
                <ChoiceCards
                  label="Speaking pace"
                  columns={1}
                  className="choice-cards--rows"
                  value={PACES.some((pace) => pace.value === brief.wpm) ? String(brief.wpm) : null}
                  onChange={(value) => patch({ wpm: Number(value) })}
                  options={PACES.map((pace) => ({ value: String(pace.value), title: pace.label, meta: <span className="tabular">{pace.value} wpm</span>, visual: <PaceVisual wpm={pace.value} /> }))}
                />
                <Slider label="Words per minute" min={LIMITS.wpm.min} max={LIMITS.wpm.max} step={5} value={brief.wpm} onChange={(wpm) => patch({ wpm })} format={(value) => `${value} wpm`} />
              </div>
              <div className="delivery-block delivery-block--full">
                <h3 className="delivery-block__title">Voice</h3>
                <ChoiceCards
                  label="Delivery style"
                  value={brief.style}
                  onChange={(style) => patch({ style })}
                  options={STYLES.map((style) => ({ value: style.value, title: style.label, icon: style.icon, description: style.description }))}
                />
                <VoiceSample label={currentStyle.label} text={currentStyle.sample} />
              </div>
              <div className="delivery-block delivery-block--full">
                <h3 className="delivery-block__title">What gets written</h3>
                <ChoiceCards
                  label="Script depth"
                  value={brief.depth}
                  onChange={(depth) => patch({ depth })}
                  options={DEPTHS.map((depth) => ({ value: depth.value, title: depth.label, description: depth.description, visual: <ShapeVisual depth={depth.value} cues={CUE_COUNT[brief.cueDensity]} /> }))}
                />
                <div className="cue-row">
                  <div>
                    <p className="cue-row__label" id="cue-label">Delivery cues</p>
                    <p className="cue-row__hint">Private reminders like &ldquo;pause&rdquo; or &ldquo;point to chart&rdquo;. Only you see them.</p>
                  </div>
                  <Segmented label="Delivery cues" size="sm" value={brief.cueDensity} onChange={(cueDensity) => patch({ cueDensity })} options={[{ value: "none", label: "None" }, { value: "light", label: "A few" }, { value: "detailed", label: "Detailed" }]} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="setup__aside" aria-label="Plan">
          <div className="plan-card">
            <h2 className="plan-card__title">Your plan</h2>
            <dl className="plan-card__rows">
              <div><dt>Speaking time</dt><dd className="tabular"><RollingText value={formatDuration(plan.speakingSeconds)} /></dd></div>
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
                {attempted && !valid && <p className="plan-card__invalid" role="alert">Include at least one slide to continue.</p>}
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
  return null;
}
