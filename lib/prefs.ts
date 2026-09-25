"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_BRIEF, withoutQaTime } from "./domain/planner";
import type { Brief } from "./domain/types";

/**
 * Per-browser conveniences (theme, panel layout, presenter reading settings, default brief).
 * Stored in localStorage; every read tolerates blocked or cleared storage.
 */
export type PresenterPrefs = {
  fontSize: number;
  lineHeight: number;
  width: number;
  paceMultiplier: number;
  mirror: boolean;
  highContrast: boolean;
  focusLine: boolean;
  showCues: boolean;
  autoAdvance: boolean;
  advanceDelay: number;
  showNext: boolean;
  calmStart: boolean;
  mode: "full" | "notes" | "keywords" | "cues";
};

export const DEFAULT_PRESENTER_PREFS: PresenterPrefs = {
  fontSize: 44,
  lineHeight: 1.5,
  width: 82,
  paceMultiplier: 1,
  mirror: false,
  highContrast: false,
  focusLine: true,
  showCues: true,
  autoAdvance: true,
  advanceDelay: 1,
  showNext: true,
  calmStart: false,
  mode: "full",
};

type PrefMap = {
  theme: "system" | "light" | "dark";
  sidebarCollapsed: boolean;
  editorInspector: boolean;
  presenter: PresenterPrefs;
  defaultBrief: Pick<Brief, "minutes" | "qaMinutes" | "wpm" | "style" | "depth" | "cueDensity" | "includeQuestions">;
};

const DEFAULTS: PrefMap = {
  theme: "system",
  sidebarCollapsed: false,
  editorInspector: true,
  presenter: DEFAULT_PRESENTER_PREFS,
  defaultBrief: {
    minutes: DEFAULT_BRIEF.minutes,
    qaMinutes: DEFAULT_BRIEF.qaMinutes,
    wpm: DEFAULT_BRIEF.wpm,
    style: DEFAULT_BRIEF.style,
    depth: DEFAULT_BRIEF.depth,
    cueDensity: DEFAULT_BRIEF.cueDensity,
    includeQuestions: DEFAULT_BRIEF.includeQuestions,
  },
};

const PREFIX = "cueframe:pref:";
const listeners = new Set<() => void>();
const cache = new Map<string, unknown>();

function read<K extends keyof PrefMap>(key: K): PrefMap[K] {
  if (cache.has(key)) return cache.get(key) as PrefMap[K];
  let value: PrefMap[K] = DEFAULTS[key];
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      value = isPlainObject(DEFAULTS[key]) && isPlainObject(parsed) ? { ...DEFAULTS[key] as object, ...parsed } as PrefMap[K] : parsed;
    }
  } catch { /* storage unavailable: defaults */ }
  if (key === "defaultBrief") value = withoutQaTime(value as PrefMap["defaultBrief"]) as PrefMap[K];
  cache.set(key, value);
  return value;
}

export function getPref<K extends keyof PrefMap>(key: K): PrefMap[K] {
  if (typeof window === "undefined") return DEFAULTS[key];
  return read(key);
}

export function setPref<K extends keyof PrefMap>(key: K, value: PrefMap[K]) {
  cache.set(key, value);
  try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* best effort */ }
  if (key === "theme") applyTheme(value as PrefMap["theme"]);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(PREFIX)) return;
    cache.delete(event.key.slice(PREFIX.length));
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePref<K extends keyof PrefMap>(key: K): [PrefMap[K], (value: PrefMap[K] | ((current: PrefMap[K]) => PrefMap[K])) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => DEFAULTS[key]);
  const update = useCallback((next: PrefMap[K] | ((current: PrefMap[K]) => PrefMap[K])) => {
    setPref(key, typeof next === "function" ? (next as (current: PrefMap[K]) => PrefMap[K])(read(key)) : next);
  }, [key]);
  return [value, update];
}

export function applyTheme(theme: PrefMap["theme"]) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
