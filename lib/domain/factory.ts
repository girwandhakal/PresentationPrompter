import { DEFAULT_BRIEF, emptyScript } from "./planner";
import type { Brief, Project, Slide, SourceKind } from "./types";

export function shortId(length = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export type ImportedSlide = Omit<Slide, "id" | "optional" | "targetSeconds" | "analysis" | "script"> & { id?: string };

export function createProject(input: {
  title: string;
  fileName: string;
  kind: SourceKind;
  bytes: number;
  aspectRatio: number;
  slides: ImportedSlide[];
  brief?: Partial<Brief>;
}): Project {
  const now = Date.now();
  return {
    id: shortId(),
    title: input.title || "Untitled presentation",
    createdAt: now,
    updatedAt: now,
    status: "setup",
    source: { fileName: input.fileName, kind: input.kind, bytes: input.bytes },
    aspectRatio: input.aspectRatio,
    slides: input.slides.map((slide) => ({
      ...slide,
      id: slide.id ?? shortId(8),
      optional: false,
      targetSeconds: null,
      analysis: null,
      script: emptyScript(),
    })),
    brief: { ...DEFAULT_BRIEF, ...input.brief },
    context: null,
    analysis: { status: "idle" },
    generation: { status: "idle" },
    generatedWith: null,
    lastPresentedAt: null,
  };
}
