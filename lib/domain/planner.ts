import { documentToWordCount, emptyDocument, wordsToSeconds } from "./script";
import type { Brief, Project, ScriptDepth, Slide, SlideScript } from "./types";

export const DEFAULT_BRIEF: Brief = {
  goal: "",
  audience: "",
  keyMessage: "",
  mustInclude: "",
  avoid: "",
  presenterRole: "",
  minutes: 8,
  qaMinutes: 0,
  wpm: 130,
  style: "conversational",
  depth: "full",
  cueDensity: "light",
  includeQuestions: true,
};

export const LIMITS = {
  minutes: { min: 1, max: 120 },
  qaMinutes: { min: 0, max: 60 },
  wpm: { min: 80, max: 220 },
};

/** Share of raw speaking time left after pauses, breaths, slide changes, and visual explanation. */
export const USABLE_FACTOR = 0.88;

/** How much of the spoken budget is written down for each script depth. */
export const DEPTH_FACTOR: Record<ScriptDepth, number> = { full: 1, notes: 0.45, cues: 0.2 };

export function emptyScript(): SlideScript {
  return {
    document: emptyDocument(),
    purpose: "",
    concise: "",
    keywords: [],
    transition: "",
    recovery: "",
    questions: [],
    origin: "empty",
  };
}

/**
 * Time for questions is no longer a setting. Older projects and saved defaults reserved Q&A minutes
 * out of the total; folding them into the total keeps their speaking time, and so every slide
 * budget, exactly as it was.
 */
export function withoutQaTime<T extends Pick<Brief, "minutes" | "qaMinutes">>(brief: T): T {
  return brief.qaMinutes ? { ...brief, minutes: Math.max(LIMITS.minutes.min, brief.minutes - brief.qaMinutes), qaMinutes: 0 } : brief;
}

export function clampBrief(brief: Brief): Brief {
  const clamp = (value: number, { min, max }: { min: number; max: number }, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const minutes = clamp(brief.minutes, LIMITS.minutes, DEFAULT_BRIEF.minutes);
  return {
    ...brief,
    minutes,
    qaMinutes: Math.min(clamp(brief.qaMinutes, LIMITS.qaMinutes, 0), Math.max(0, minutes - 1)),
    wpm: clamp(brief.wpm, LIMITS.wpm, DEFAULT_BRIEF.wpm),
  };
}

/** Complexity estimate used before (or without) AI analysis. */
export function heuristicComplexity(slide: Pick<Slide, "text" | "analysis">, index: number, total: number) {
  if (slide.analysis) return slide.analysis.complexity;
  const words = slide.text.trim().split(/\s+/).filter(Boolean).length;
  if (index === 0 && words < 25) return 1;
  if (index === total - 1 && words < 20) return 2;
  if (words < 12) return 2;
  if (words < 45) return 3;
  if (words < 90) return 4;
  return 5;
}

export type SlidePlan = {
  slideId: string;
  seconds: number;
  /** Words to write for this slide at the chosen depth. */
  words: number;
  /** Words the presenter will actually speak. */
  spokenWords: number;
  pinned: boolean;
};

export type PlanWarning = { level: "info" | "warn"; message: string };

export type Plan = {
  speakingSeconds: number;
  rawWords: number;
  usableWords: number;
  writtenWords: number;
  includedSlides: number;
  slides: SlidePlan[];
  warnings: PlanWarning[];
  range: [number, number];
};

export function planPresentation(briefInput: Brief, slides: (Pick<Slide, "id" | "text" | "analysis" | "optional" | "targetSeconds"> & { notes?: string })[]): Plan {
  const brief = clampBrief(briefInput);
  const speakingSeconds = Math.max(30, (brief.minutes - brief.qaMinutes) * 60);
  const rawWords = Math.round((speakingSeconds / 60) * brief.wpm);
  const usableWords = Math.round(rawWords * USABLE_FACTOR);
  const depthFactor = DEPTH_FACTOR[brief.depth];
  const included = slides.filter((slide) => !slide.optional);

  const pinnedSeconds = included.reduce((sum, slide) => sum + (slide.targetSeconds ?? 0), 0);
  const flexible = included.filter((slide) => slide.targetSeconds == null);
  const weights = new Map(flexible.map((slide) => {
    const index = slides.indexOf(slide);
    return [slide.id, 0.6 + 0.35 * heuristicComplexity(slide, index, slides.length)];
  }));
  const weightTotal = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const flexibleSeconds = Math.max(0, speakingSeconds - pinnedSeconds);

  const slidePlans: SlidePlan[] = slides.map((slide) => {
    if (slide.optional) return { slideId: slide.id, seconds: 0, words: 0, spokenWords: 0, pinned: false };
    const pinned = slide.targetSeconds != null;
    const seconds = pinned ? slide.targetSeconds! : Math.round(flexibleSeconds * (weights.get(slide.id)! / weightTotal));
    const spokenWords = Math.round((seconds / 60) * brief.wpm * USABLE_FACTOR);
    return { slideId: slide.id, seconds, words: Math.max(depthFactor < 1 ? 6 : 12, Math.round(spokenWords * depthFactor)), spokenWords, pinned };
  });

  // Dividers and short title slides do not earn filler merely because the talk is long.
  const sparse = new Set(flexible.filter((slide) => ["title", "section"].includes(slide.analysis?.kind ?? "") && `${slide.text} ${slide.notes ?? ""}`.split(/\s+/).length < 35).map((slide) => slide.id));
  let spareSeconds = 0;
  for (const entry of slidePlans) {
    if (!sparse.has(entry.slideId) || entry.seconds <= 20) continue;
    spareSeconds += entry.seconds - 20;
    entry.seconds = 20;
  }
  const recipients = slidePlans.filter((entry) => !entry.pinned && !sparse.has(entry.slideId) && entry.seconds > 0);
  const recipientWeight = recipients.reduce((sum, entry) => sum + (weights.get(entry.slideId) ?? 1), 0);
  for (const entry of slidePlans) {
    if (recipients.includes(entry) && recipientWeight) entry.seconds += Math.round(spareSeconds * (weights.get(entry.slideId) ?? 1) / recipientWeight);
    entry.spokenWords = Math.round(entry.seconds / 60 * brief.wpm * USABLE_FACTOR);
    if (entry.seconds > 0) entry.words = brief.depth === "cues" ? Math.min(30, Math.max(6, Math.round(entry.spokenWords * depthFactor))) : Math.max(depthFactor < 1 ? 6 : 12, Math.round(entry.spokenWords * depthFactor));
  }
  const warnings: PlanWarning[] = [];
  if (spareSeconds && !recipients.length) warnings.push({ level: "warn", message: "These slides contain too little material for the requested duration. Add supporting notes or shorten the talk; the writer will not pad the script." });
  const perSlide = included.length ? usableWords / included.length : 0;
  if (!included.length) warnings.push({ level: "warn", message: "Every slide is marked optional. Include at least one slide." });
  if (pinnedSeconds > speakingSeconds) warnings.push({ level: "warn", message: `Slide time targets add up to more than the ${Math.round(speakingSeconds / 60)} minutes of speaking time.` });
  if (included.length && brief.depth === "full" && perSlide < 30) warnings.push({ level: "warn", message: `That's about ${Math.round(perSlide)} spoken words per slide — tight for a full script. Try more time, concise notes, or marking some slides optional.` });
  if (included.length && perSlide > 450) warnings.push({ level: "info", message: `About ${Math.round(perSlide / brief.wpm)} minutes per slide. Expect a slower, discussion-heavy pace.` });
  if (brief.wpm > 175) warnings.push({ level: "info", message: "Above 175 words per minute can feel rushed to most audiences." });

  const writtenWords = slidePlans.reduce((sum, plan) => sum + plan.words, 0);
  return {
    speakingSeconds,
    rawWords,
    usableWords,
    writtenWords,
    includedSlides: included.length,
    slides: slidePlans,
    warnings,
    range: [Math.round(usableWords * 0.92 / 10) * 10, Math.round(rawWords * 0.96 / 10) * 10],
  };
}

export function projectPlan(project: Pick<Project, "brief" | "slides">) {
  return planPresentation(project.brief, project.slides);
}

/** Spoken seconds for a slide's current script (full depth reads the document; notes are ad-libbed to plan). */
export function slideSpokenSeconds(slide: Slide, wpm: number) {
  return wordsToSeconds(documentToWordCount(slide.script.document), wpm);
}

export function projectSpokenSeconds(project: Pick<Project, "slides" | "brief">) {
  return project.slides.filter((slide) => !slide.optional).reduce((sum, slide) => sum + slideSpokenSeconds(slide, project.brief.wpm), 0);
}

export function hasScript(project: Pick<Project, "slides">) {
  return project.slides.some((slide) => slide.script.origin !== "empty" && documentToWordCount(slide.script.document) > 0);
}

/**
 * Where a project opens: its setup until a script exists, otherwise its overview. Linking straight
 * there avoids the overview mounting only to redirect, which replays the setup page from scratch.
 */
export function projectHref(project: Pick<Project, "id" | "slides" | "status">) {
  return !hasScript(project) && project.status === "setup" ? `/p/${project.id}/setup` : `/p/${project.id}`;
}

/** A short line summarizing the plan, e.g. "8 min · 130 wpm · ~920–1,000 words · 12 slides". */
export function planSummary(brief: Brief, plan: Plan) {
  const parts = [`${brief.minutes} min`, `${brief.wpm} wpm`, `~${plan.range[0].toLocaleString()}–${plan.range[1].toLocaleString()} spoken words`, `${plan.includedSlides} slides`];
  if (brief.qaMinutes) parts.push(`${brief.qaMinutes} min Q&A`);
  return parts.join(" · ");
}
