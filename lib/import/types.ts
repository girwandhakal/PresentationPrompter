import type { SlideWarning } from "../domain/types";

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_SLIDES = 120;

export type ImportProgress = { stage: "reading" | "rendering" | "saving"; done: number; total: number };

/** A failure the user can act on; its message is shown as-is. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export type ImportContext = {
  batch: string;
  slideId: () => string;
  addBlob: (key: string, blob: Blob) => void;
  progress: (progress: ImportProgress) => void;
  assertSlideCount: (count: number) => void;
};

export const sparseTextWarning: SlideWarning = {
  kind: "sparse-text",
  message: "Little or no selectable text. The AI will read this slide from its image.",
};
