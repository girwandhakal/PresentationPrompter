"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { initialPresentations } from "./mock-data";
import { parseScriptDocument } from "./script-types";
import type { Presentation, Slide } from "./types";

const STORAGE_KEY = "cueframe-presentations-v2";

function isPresentationArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && Array.isArray((item as { slides?: unknown }).slides));
}

// Normalizes whatever shape a slide was saved in — including decks written before `script`
// became the single source of truth — into the current `Slide` shape. This is the one place
// legacy `body`/`cue` strings are still read.
function normalizeSlide(raw: Record<string, unknown>): Slide {
  return {
    id: String(raw.id ?? ""),
    eyebrow: String(raw.eyebrow ?? ""),
    title: String(raw.title ?? ""),
    marker: String(raw.marker ?? ""),
    accent: (raw.accent as Slide["accent"]) ?? "petal",
    script: parseScriptDocument(raw.script, String(raw.body ?? ""), String(raw.cue ?? "")),
  };
}

function normalizePresentation(raw: Record<string, unknown>): Presentation {
  const slides = Array.isArray(raw.slides) ? (raw.slides as Record<string, unknown>[]).map(normalizeSlide) : [];
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    updated: String(raw.updated ?? ""),
    goal: String(raw.goal ?? ""),
    audience: String(raw.audience ?? ""),
    durationMinutes: Number(raw.durationMinutes ?? 0),
    progress: Number(raw.progress ?? 0),
    slides,
  };
}

function readStorage(): Presentation[] | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isPresentationArray(parsed) ? parsed.map(normalizePresentation) : null;
  } catch {
    return null;
  }
}

type PresentationsStore = {
  presentations: Presentation[];
  ready: boolean;
  getPresentation: (id: string) => Presentation | undefined;
  addPresentation: (p: Presentation) => void;
  updateSlides: (id: string, slides: Slide[]) => void;
  renamePresentation: (id: string, title: string) => void;
  duplicatePresentation: (id: string) => Presentation | undefined;
  removePresentation: (id: string) => void;
};

function usePresentationsState(): PresentationsStore {
  const [presentations, setPresentations] = useState<Presentation[]>(initialPresentations);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStorage();
      if (stored) setPresentations(stored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presentations)); } catch { /* best effort */ }
  }, [presentations, ready]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      const stored = readStorage();
      if (stored) setPresentations(stored);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getPresentation = useCallback(
    (id: string) => presentations.find((p) => p.id === id),
    [presentations],
  );

  const addPresentation = useCallback((p: Presentation) => {
    setPresentations((cur) => [p, ...cur]);
  }, []);

  const updateSlides = useCallback((id: string, slides: Slide[]) => {
    setPresentations((cur) => cur.map((p) => p.id === id ? { ...p, slides, updated: "Just now" } : p));
  }, []);

  const renamePresentation = useCallback((id: string, title: string) => {
    const next = title.trim();
    if (!next) return;
    setPresentations((cur) => cur.map((p) => p.id === id ? { ...p, title: next, updated: "Just now" } : p));
  }, []);

  const duplicatePresentation = useCallback((id: string) => {
    const src = presentations.find((p) => p.id === id);
    if (!src) return undefined;
    const copy: Presentation = { ...src, id: `${src.id}-${Date.now()}`, title: `${src.title} — copy`, updated: "Just now" };
    setPresentations((cur) => [copy, ...cur]);
    return copy;
  }, [presentations]);

  const removePresentation = useCallback((id: string) => {
    setPresentations((cur) => {
      const remaining = cur.filter((p) => p.id !== id);
      return remaining.length ? remaining : initialPresentations;
    });
  }, []);

  return {
    presentations,
    ready,
    getPresentation,
    addPresentation,
    updateSlides,
    renamePresentation,
    duplicatePresentation,
    removePresentation,
  };
}

const PresentationsContext = createContext<PresentationsStore | null>(null);

export function PresentationsProvider({ children }: { children: ReactNode }) {
  const store = usePresentationsState();
  return <PresentationsContext.Provider value={store}>{children}</PresentationsContext.Provider>;
}

export function usePresentations(): PresentationsStore {
  const store = useContext(PresentationsContext);
  if (!store) throw new Error("usePresentations() must be used within a PresentationsProvider");
  return store;
}
