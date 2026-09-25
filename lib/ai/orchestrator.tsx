"use client";

import { useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { stableContext } from "../stable-context";
import { planPresentation, hasScript } from "../domain/planner";
import type { DeckContext, Project, Slide, SlideAnalysis } from "../domain/types";
import { useProjects } from "../store/projects";
import { aiFetch, AiRequestError, analysisInput, briefInput, contextInput, scriptFromWritten, slideImageForAi } from "./client";
import { aiLockName } from "./lock";
import type { WrittenSlideOutput } from "./schemas";

/**
 * Runs the AI pipeline for a project from the browser, one bounded request at a time:
 *
 *   analyze (vision + text, batched)  →  deck context  →  plan (local)  →  outline  →  write (batched)
 *
 * Analysis starts as soon as slides are imported so the setup form can show suggestions. Generation
 * is deliberately quiet: the project shows one calm "writing" state, and the finished draft is
 * committed only when every slide came back valid. Lives above the routes so in-app navigation
 * doesn't interrupt it.
 */

const ANALYZE_BATCH = 4;
const WRITE_BATCH = 2;
const CONCURRENCY = 6;

type Orchestrator = {
  analyze: (projectId: string) => Promise<void>;
  generate: (projectId: string) => Promise<void>;
  cancel: (projectId: string) => void;
};

const OrchestratorContext = stableContext<Orchestrator | null>("orchestrator", null);

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

/** Runs work with bounded concurrency; after the first failure no further items are started. */
async function runLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && next < items.length) {
      try {
        await work(items[next++]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }));
}

/**
 * Holds a Web Lock for the duration of AI work on a project, so other tabs can tell a live run
 * from one interrupted by a closed tab (see recoverInterrupted in the store).
 */
async function holdLock(name: string): Promise<() => void> {
  if (typeof navigator === "undefined" || !navigator.locks) return () => {};
  let release = () => {};
  await new Promise<void>((acquired) => {
    void navigator.locks.request(name, () => new Promise<void>((done) => {
      release = done;
      acquired();
    }));
  });
  return release;
}

function userMessage(error: unknown) {
  if (error instanceof AiRequestError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "Generation was cancelled.";
  return "Something went wrong while writing the script. Try again.";
}

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const { update } = useProjects();
  const generating = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const analyses = useRef(new Map<string, Promise<void>>());

  const latest = useCallback(async (id: string): Promise<Project> => {
    const project = await update(id, (current) => current, { touch: false });
    if (!project) throw new Error("This presentation no longer exists.");
    return project;
  }, [update]);

  const runAnalysis = useCallback(async (projectId: string, signal: AbortSignal) => {
    const project = await latest(projectId);
    const pending = project.slides.filter((slide) => !slide.analysis);
    if (pending.length) {
      await update(projectId, (current) => ({ ...current, analysis: { status: "running" } }), { touch: false });
      let failures = 0;
      let lastError: unknown = null;
      await runLimited(chunk(pending, ANALYZE_BATCH), CONCURRENCY, async (batch) => {
        if (signal.aborted) return;
        try {
          const slides = await Promise.all(batch.map(async (slide) => ({
            id: slide.id,
            index: project.slides.indexOf(slide) + 1,
            title: slide.title.slice(0, 300),
            text: slide.text.slice(0, 6000),
            notes: slide.notes.slice(0, 4000),
            image: await slideImageForAi(slide),
          })));
          const result = await aiFetch<{ slides: { id: string; analysis: SlideAnalysis | null }[] }>("analyze", {
            fileName: project.source.fileName.slice(0, 260),
            slideCount: project.slides.length,
            slides,
          }, signal);
          const byId = new Map(result.slides.map((entry) => [entry.id, entry.analysis]));
          await update(projectId, (current) => ({
            ...current,
            slides: current.slides.map((slide) => byId.get(slide.id) ? { ...slide, analysis: byId.get(slide.id)! } : slide),
          }), { touch: false });
        } catch (error) {
          if (signal.aborted) return;
          failures += 1;
          lastError = error;
          // A missing analysis only lowers quality: generation still works from slide text.
          if (error instanceof AiRequestError && (error.code === "ai_unavailable" || error.code === "auth" || error.code === "model")) throw error;
        }
      });
      if (signal.aborted) return;
      if (failures && failures === Math.ceil(pending.length / ANALYZE_BATCH)) {
        await update(projectId, (current) => ({ ...current, analysis: { status: "failed", error: userMessage(lastError) } }), { touch: false });
        return;
      }
    }

    const analyzed = await latest(projectId);
    if (!analyzed.context) {
      try {
        const result = await aiFetch<{ context: DeckContext }>("context", {
          fileName: analyzed.source.fileName.slice(0, 260),
          slides: analyzed.slides.map((slide, index) => ({
            index: index + 1,
            title: (slide.analysis?.title || slide.title).slice(0, 300),
            mainPoint: (slide.analysis?.mainPoint ?? slide.text.slice(0, 200)).slice(0, 600),
            kind: slide.analysis?.kind ?? "content",
          })),
        }, signal);
        await update(projectId, (current) => ({ ...current, context: result.context }), { touch: false });
      } catch {
        // Context is only used for suggestions and flavor; never block on it.
      }
    }
    await update(projectId, (current) => ({ ...current, analysis: { status: "done" } }), { touch: false });
  }, [latest, update]);

  const analyze = useCallback((projectId: string) => {
    const existing = analyses.current.get(projectId);
    if (existing) return existing;
    const controller = controllers.current.get(projectId) ?? new AbortController();
    controllers.current.set(projectId, controller);
    const job = (async () => {
      const release = await holdLock(aiLockName("analyze", projectId));
      try {
        await runAnalysis(projectId, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          await update(projectId, (current) => ({ ...current, analysis: { status: "failed", error: userMessage(error) } }), { touch: false });
        }
      } finally {
        release();
      }
      // A cancelled run must not leave the setup page waiting on analysis that will never finish.
      if (controller.signal.aborted) {
        await update(projectId, (current) => current.analysis.status === "running" ? { ...current, analysis: { status: "idle" } } : current, { touch: false });
      }
    })()
      .finally(() => {
        analyses.current.delete(projectId);
        if (controllers.current.get(projectId) === controller && !generating.current.has(projectId)) controllers.current.delete(projectId);
      });
    analyses.current.set(projectId, job);
    return job;
  }, [runAnalysis, update]);

  const generate = useCallback(async (projectId: string) => {
    if (generating.current.has(projectId)) return;
    generating.current.add(projectId);
    const controller = controllers.current.get(projectId) ?? new AbortController();
    controllers.current.set(projectId, controller);
    const signal = controller.signal;
    const release = await holdLock(aiLockName("generate", projectId));

    try {
      await update(projectId, (current) => ({ ...current, generation: { status: "running", phase: "analyzing", startedAt: Date.now() } }));
      await analyze(projectId);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await update(projectId, (current) => ({ ...current, generation: { status: "running", phase: "writing", startedAt: current.generation.status === "running" ? current.generation.startedAt : Date.now() } }), { touch: false });

      const project = await latest(projectId);
      const plan = planPresentation(project.brief, project.slides);
      const included = plan.slides.filter((entry) => entry.words > 0);
      const averageWords = included.length ? included.reduce((sum, entry) => sum + entry.words, 0) / included.length : 60;
      const targets = new Map(plan.slides.map((entry) => [entry.slideId, entry.words > 0 ? entry.words : Math.max(20, Math.round(averageWords * 0.6))]));
      const brief = briefInput(project.brief);
      const context = contextInput(project);
      const title = project.title.slice(0, 200);

      const outline = await aiFetch<{ arc: string; slides: { id: string; role: string; keyIdea: string; transition: string }[] }>("outline", {
        brief,
        context,
        title,
        slides: project.slides.map((slide, index) => ({
          id: slide.id,
          index: index + 1,
          title: slide.title.slice(0, 300),
          mainPoint: (slide.analysis?.mainPoint ?? slide.text.slice(0, 300)).slice(0, 600),
          kind: slide.analysis?.kind ?? "content",
          targetWords: Math.min(5000, targets.get(slide.id) ?? 60),
          optional: slide.optional,
        })),
      }, signal);
      const planned = new Map(outline.slides.map((entry) => [entry.id, entry]));

      const written = new Map<string, WrittenSlideOutput>();
      const batches = chunk(project.slides.map((slide, index) => ({ slide, index })), WRITE_BATCH);
      await runLimited(batches, CONCURRENCY, async (batch) => {
        if (signal.aborted) return;
        const result = await aiFetch<{ slides: { id: string; script: WrittenSlideOutput | null }[] }>("write", {
          brief,
          context,
          title,
          arc: outline.arc.slice(0, 2000),
          totalSlides: project.slides.length,
          slides: batch.map(({ slide, index }) => slideWriteInput(project, slide, index, targets.get(slide.id) ?? 60, planned.get(slide.id))),
        }, signal);
        for (const entry of result.slides) if (entry.script) written.set(entry.id, entry.script);
      });
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const missing = project.slides.filter((slide) => !written.has(slide.id));
      if (missing.length) throw new AiRequestError(`The AI didn't return a script for ${missing.length === 1 ? "one slide" : `${missing.length} slides`}. Try again.`, 502, "incomplete");

      // Keep what was there before, so regenerating is always reversible.
      const before = await latest(projectId);
      if (hasScript(before)) {
        await saveVersionSnapshot(before, "Before regenerating");
      }

      const committed = await update(projectId, (current) => ({
        ...current,
        status: "ready",
        generation: { status: "idle" },
        generatedWith: { minutes: current.brief.minutes, qaMinutes: current.brief.qaMinutes, wpm: current.brief.wpm, depth: current.brief.depth },
        slides: current.slides.map((slide) => written.has(slide.id) ? { ...slide, script: scriptFromWritten(written.get(slide.id)!) } : slide),
      }));
      if (committed) await saveVersionSnapshot(committed, "Generated draft");
    } catch (error) {
      await update(projectId, (current) => ({
        ...current,
        generation: signal.aborted ? { status: "idle" } : { status: "failed", error: userMessage(error), at: Date.now() },
      }), { touch: false });
      if (!signal.aborted) throw error;
    } finally {
      release();
      generating.current.delete(projectId);
      if (controllers.current.get(projectId) === controller) controllers.current.delete(projectId);
    }
  }, [analyze, latest, update]);

  const cancel = useCallback((projectId: string) => {
    controllers.current.get(projectId)?.abort();
    controllers.current.delete(projectId);
  }, []);

  const value = useMemo(() => ({ analyze, generate, cancel }), [analyze, generate, cancel]);
  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

function slideWriteInput(project: Project, slide: Slide, index: number, targetWords: number, planned?: { role: string; keyIdea: string; transition: string }) {
  return {
    id: slide.id,
    index: index + 1,
    title: slide.title.slice(0, 300),
    text: slide.text.slice(0, 6000),
    notes: slide.notes.slice(0, 4000),
    analysis: analysisInput(slide.analysis),
    role: (planned?.role ?? "").slice(0, 400),
    keyIdea: (planned?.keyIdea ?? "").slice(0, 600),
    transition: (planned?.transition ?? "").slice(0, 600),
    targetWords: Math.min(5000, Math.max(0, Math.round(targetWords))),
    previousTitle: project.slides[index - 1]?.title.slice(0, 300) ?? "",
    nextTitle: project.slides[index + 1]?.title.slice(0, 300) ?? "",
  };
}

async function saveVersionSnapshot(project: Project, label: string) {
  const { addVersion } = await import("../store/db");
  const { shortId } = await import("../domain/factory");
  await addVersion({
    id: shortId(12),
    projectId: project.id,
    createdAt: Date.now(),
    label,
    slides: project.slides.map((slide) => ({ slideId: slide.id, script: structuredClone(slide.script) })),
  });
}

export function useOrchestrator() {
  const context = useContext(OrchestratorContext);
  if (!context) throw new Error("useOrchestrator() must be used inside <OrchestratorProvider>.");
  return context;
}
