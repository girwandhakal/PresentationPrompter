"use client";

import { useEffect, useState } from "react";
import { initialPresentations } from "../components/workspace/mock-data";
import { SlideVisual } from "../components/workspace/SlideVisual";
import type { Presentation } from "../components/workspace/types";

const STORAGE_KEY = "cueframe-presentations-v2";
const ACTIVE_STORAGE_KEY = "cueframe-active-presentation-v1";

export default function AudiencePage() {
  const [deck, setDeck] = useState<Presentation>(initialPresentations[0]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const presentations = JSON.parse(stored) as Presentation[];
      const activeId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      const selected = presentations.find((presentation) => presentation.id === activeId) ?? presentations[0];
      if (selected?.slides.length) queueMicrotask(() => setDeck(selected));
    } catch { /* use the sample deck when local storage is unavailable */ }
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel("cueframe-presenter-session");
    channel.onmessage = (event) => {
      if (event.data?.type === "snapshot" && typeof event.data.index === "number") setIndex(event.data.index);
    };
    channel.postMessage({ type: "ready" });
    return () => channel.close();
  }, []);

  return <main className="audience-shell"><SlideVisual slide={deck.slides[index] ?? deck.slides[0]} /></main>;
}
