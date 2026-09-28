"use client";

import { ArrowRight, Ban, CircleAlert, ListChecks, Quote, Sparkles, Target, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAiStatus } from "@/lib/ai/client";
import { useOrchestrator } from "@/lib/ai/orchestrator";
import { fileBaseName, formatDuration } from "@/lib/domain/format";
import { clampBrief, hasScript, planPresentation } from "@/lib/domain/planner";
import type { Brief, Project } from "@/lib/domain/types";
import { setPref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { Button, ButtonLink } from "../ui/button";
import { Callout, Spinner } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { RollingText } from "../ui/motion";
import { useToast } from "../ui/toast";
import { BriefRow, ExtraFields, type Chip } from "./BriefControls";
import { DeliveryFields } from "./DeliveryFields";
import { GeneratingView } from "./GeneratingView";
import { RebalanceDialog } from "./RebalanceDialog";
import { SlideReview } from "./SlideReview";

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
  { key: "voiceSample", label: "Your speaking style", add: "Voice sample", icon: <Quote />, placeholder: "Optional: a few sentences you would naturally say. Used for style, not new facts.", maxLength: 1500 },
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
  // A finished run hands straight over to the editor. The writing screen stays up until the editor
  // replaces it; otherwise the setup form flashes between the two while the route loads.
  const [handoff, setHandoff] = useState(false);
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (!running && project.generation.status === "idle" && project.status === "ready") setHandoff(true);
  }
  useEffect(() => {
    if (!handoff) return;
    toast("Your script is ready");
    router.push(`/p/${project.id}/edit`);
  }, [handoff, project.id, router, toast]);

  // Nothing here is required: a blank goal or audience is written with these defaults.
  const defaults = {
    goal: `Help the audience understand ${title.trim() || "this presentation"}`,
    audience: "A general audience",
  };
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
    setPref("defaultBrief", { minutes: brief.minutes, qaMinutes: brief.qaMinutes, wpm: brief.wpm, style: brief.style, depth: brief.depth, includeQuestions: brief.includeQuestions });
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

  if (running || handoff) return <GeneratingView onCancel={() => orchestrator.cancel(project.id)} />;

  const failed = project.generation.status === "failed" ? project.generation.error : null;

  return (
    <div className="setup">
      <h1 className="sr-only">Setup</h1>

      <div className="setup__layout">
        <div className="setup__main">
          <section className="setup-section" aria-labelledby="setup-slides">
            <div className="setup-section__head">
              <h2 id="setup-slides" className="section-title">Slides</h2>
              <p className="setup-section__meta">{project.slides.length} {project.slides.length === 1 ? "Slide" : "Slides"}</p>
            </div>
            <SlideReview project={project} />
          </section>

          <section className="setup-section" aria-labelledby="setup-about">
            <div className="setup-section__head">
              <h2 id="setup-about" className="section-title">Teleprompter settings</h2>
              <AnalysisStatus project={project} aiReady={aiReady} onRetry={() => orchestrator.analyze(project.id)} />
            </div>
            <div className="brief-card">
              <div className="brief-title" data-suggested={suggested.title || undefined}>
                <label htmlFor="brief-title" className="brief-title__label">Title</label>
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
              values={{ voiceSample: brief.voiceSample ?? "", mustInclude: brief.mustInclude, avoid: brief.avoid, presenterRole: brief.presenterRole }}
              onChange={(key, value) => patch({ [key]: value })}
            />
            <DeliveryFields
              value={brief}
              onChange={(values) => patch(values)}
              perSlide={plan.includedSlides ? formatDuration(plan.speakingSeconds / plan.includedSlides) : null}
            />
          </section>
        </div>

        <aside className="setup__aside" aria-label="Plan">
          <div className="plan-card">
            <h2 className="plan-card__title">Your plan</h2>
            <dl className="plan-card__rows">
              <div><dt>Speaking time</dt><dd className="tabular"><RollingText value={formatDuration(plan.speakingSeconds)} /></dd></div>
              <div><dt>Spoken words</dt><dd className="tabular"><RollingText value={`~${plan.range[0].toLocaleString()}–${plan.range[1].toLocaleString()}`} /></dd></div>
              <div><dt>Slides</dt><dd className="tabular"><RollingText value={String(plan.includedSlides)} /></dd></div>
            </dl>
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
            {aiReady === false && (
              <Callout tone="warn" title="AI isn't set up">This server doesn&apos;t have an AI key yet, so scripts can&apos;t be written. You can still write your own script in the editor.</Callout>
            )}

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
