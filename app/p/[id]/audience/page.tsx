"use client";

import { use, useEffect, useState } from "react";
import { SlideVisual } from "../../../components/workspace/SlideVisual";
import { usePresentations } from "../../../components/workspace/use-presentations";

export default function AudiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getPresentation } = usePresentations();
  const deck = getPresentation(id);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const channel = new BroadcastChannel(`cueframe-presenter-session-${id}`);
    channel.onmessage = (event) => {
      if (event.data?.type === "snapshot" && typeof event.data.index === "number") setIndex(event.data.index);
    };
    channel.postMessage({ type: "ready" });
    return () => channel.close();
  }, [id]);

  if (!deck) return null;

  return <main className="audience-shell"><SlideVisual slide={deck.slides[index] ?? deck.slides[0]} /></main>;
}
