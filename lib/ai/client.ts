"use client";

import { useEffect, useState } from "react";
import { documentFromAi, documentToParagraphs, makeId } from "../domain/script";
import type { Brief, Project, Slide, SlideAnalysis, SlideScript } from "../domain/types";
import { getBlob } from "../store/db";
import type { AiStatus, BriefInput, RewriteRequest, WrittenSlideOutput } from "./schemas";

export class AiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "AiRequestError";
  }
}

const RETRYABLE = new Set([502, 503, 504]);

export async function aiFetch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`/api/ai/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt < 1) {
        await wait(1500, signal);
        continue;
      }
      throw new AiRequestError("Couldn't reach Cueframe's server. Check your connection and try again.", 0, "network");
    }
    if (response.ok) return (await response.json()) as T;
    const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    const retryable = (RETRYABLE.has(response.status) && payload.code !== "ai_unavailable" && payload.code !== "auth" && payload.code !== "model") || response.status === 429;
    if (retryable && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after")) || 0;
      await wait(Math.min(20_000, retryAfter * 1000 || 2000 * (attempt + 1)), signal);
      continue;
    }
    throw new AiRequestError(payload.error ?? "The AI request failed. Try again.", response.status, payload.code ?? "unknown");
  }
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

// ── Status ──────────────────────────────────────────────────────────────────

let statusPromise: Promise<AiStatus> | null = null;

export function fetchAiStatus() {
  statusPromise ??= fetch("/api/ai/status", { cache: "no-store" })
    .then((response) => response.json() as Promise<AiStatus>)
    .catch(() => {
      statusPromise = null;
      return { provider: "none", model: null } as AiStatus;
    });
  return statusPromise;
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let active = true;
    fetchAiStatus().then((value) => { if (active) setStatus(value); });
    return () => { active = false; };
  }, []);
  return status;
}

// ── Request builders ────────────────────────────────────────────────────────

export function briefInput(brief: Brief): BriefInput {
  return {
    goal: brief.goal.slice(0, 600),
    audience: brief.audience.slice(0, 400),
    keyMessage: brief.keyMessage.slice(0, 600),
    mustInclude: brief.mustInclude.slice(0, 1500),
    avoid: brief.avoid.slice(0, 800),
    presenterRole: brief.presenterRole.slice(0, 300),
    minutes: brief.minutes,
    qaMinutes: brief.qaMinutes,
    wpm: brief.wpm,
    style: brief.style,
    depth: brief.depth,
    cueDensity: brief.cueDensity,
    includeQuestions: false, // Q&A prep was removed from the UI; skipping it also shortens generation.
  };
}

export function analysisInput(analysis: SlideAnalysis | null) {
  if (!analysis) return null;
  return {
    mainPoint: analysis.mainPoint.slice(0, 600),
    visualSummary: analysis.visualSummary.slice(0, 1200),
    elements: analysis.elements.slice(0, 12).map((element) => ({ label: element.label.slice(0, 200), region: element.region.slice(0, 80) })),
    kind: analysis.kind,
    complexity: analysis.complexity,
    uncertain: analysis.uncertain.slice(0, 6).map((item) => item.slice(0, 300)),
  };
}

export function contextInput(project: Project) {
  return project.context ? { title: project.context.title.slice(0, 200), topic: project.context.topic.slice(0, 300), summary: project.context.summary.slice(0, 1200) } : null;
}

export function slideRewriteContext(project: Project, slide: Slide) {
  const index = project.slides.findIndex((item) => item.id === slide.id);
  return {
    title: slide.title.slice(0, 300),
    text: slide.text.slice(0, 6000),
    notes: slide.notes.slice(0, 4000),
    analysis: analysisInput(slide.analysis),
    previousTitle: project.slides[index - 1]?.title.slice(0, 300) ?? "",
    nextTitle: project.slides[index + 1]?.title.slice(0, 300) ?? "",
  };
}

type ScriptResult = { kind: "script"; paragraphs: string[]; cues: WrittenSlideOutput["cues"] };
type SelectionResult = { kind: "selection"; text: string };
type SupportResult = { kind: "support"; concise: string; keywords: string[]; recovery: string; transition: string };
type QuestionsResult = { kind: "questions"; questions: { question: string; answer: string }[] };

export type ScriptAction = Extract<RewriteRequest, { kind: "script" }>["action"];
export type SelectionAction = Extract<RewriteRequest, { kind: "selection" }>["action"];

export function rewriteScript(project: Project, slide: Slide, action: ScriptAction, targetWords: number, signal?: AbortSignal) {
  return aiFetch<ScriptResult>("rewrite", {
    kind: "script",
    action,
    brief: briefInput(project.brief),
    title: project.title.slice(0, 200),
    slide: slideRewriteContext(project, slide),
    paragraphs: documentToParagraphs(slide.script.document).slice(0, 40).map((paragraph) => paragraph.slice(0, 4000)),
    targetWords: Math.max(5, Math.min(5000, Math.round(targetWords))),
  }, signal);
}

export function rewriteSelection(project: Project, slide: Slide, action: SelectionAction, selection: string, signal?: AbortSignal) {
  return aiFetch<SelectionResult>("rewrite", {
    kind: "selection",
    action,
    brief: briefInput(project.brief),
    title: project.title.slice(0, 200),
    slide: slideRewriteContext(project, slide),
    paragraphs: documentToParagraphs(slide.script.document).slice(0, 40).map((paragraph) => paragraph.slice(0, 4000)),
    selection: selection.slice(0, 4000),
  }, signal);
}

export function regenerateSupport(project: Project, slide: Slide, signal?: AbortSignal) {
  return aiFetch<SupportResult>("rewrite", {
    kind: "support",
    brief: briefInput(project.brief),
    title: project.title.slice(0, 200),
    slide: slideRewriteContext(project, slide),
    paragraphs: documentToParagraphs(slide.script.document).slice(0, 40),
  }, signal);
}

export function generateQuestions(project: Project, slide: Slide, signal?: AbortSignal) {
  return aiFetch<QuestionsResult>("rewrite", {
    kind: "questions",
    brief: briefInput(project.brief),
    title: project.title.slice(0, 200),
    slide: slideRewriteContext(project, slide),
    paragraphs: documentToParagraphs(slide.script.document).slice(0, 40),
  }, signal);
}

/** Converts a written-slide payload into the stored script shape. */
export function scriptFromWritten(written: Omit<WrittenSlideOutput, "flags"> & { flags: { kind: string; message: string }[] }): SlideScript {
  return {
    document: documentFromAi(written.paragraphs, written.cues.map((cue) => ({ paragraph: cue.paragraph, afterSentence: cue.afterSentence, label: cue.text }))),
    purpose: written.purpose,
    concise: written.concise,
    keywords: written.keywords,
    transition: written.transition,
    recovery: written.recovery,
    questions: written.questions.map((question) => ({ id: makeId("q"), question: question.question, answer: question.answer })),
    flags: written.flags as SlideScript["flags"],
    origin: "ai",
  };
}

// ── Slide images for vision analysis ────────────────────────────────────────

const AI_IMAGE_WIDTH = 1280;

/** Downscaled JPEG data URL of a slide, sized for vision models rather than for display. */
export async function slideImageForAi(slide: Slide): Promise<string | null> {
  const blob = await getBlob(slide.imageKey);
  if (!blob) return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, AI_IMAGE_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL("image/jpeg", 0.8);
    canvas.width = 0;
    return url;
  } catch {
    return null;
  }
}
