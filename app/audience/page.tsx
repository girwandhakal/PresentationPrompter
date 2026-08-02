"use client";

import { useEffect, useState } from "react";
import { initialPresentations } from "../components/workspace/mock-data";
import { SlideVisual } from "../components/workspace/SlideVisual";

const deck = initialPresentations[0];

export default function AudiencePage() {
  const [index, setIndex] = useState(0);

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
