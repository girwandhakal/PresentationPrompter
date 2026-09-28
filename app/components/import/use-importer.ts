"use client";

import { useCallback, useRef, useState } from "react";
import { ImportError, importFiles, type ImportProgress, type ImportResult } from "@/lib/import";

export type ImporterState =
  | { status: "idle" }
  | { status: "working"; fileName: string; progress: ImportProgress }
  | { status: "error"; message: string };

/** Runs the in-browser import with progress and cancellation. */
export function useImporter({ onImported }: {
  onImported: (result: ImportResult) => Promise<void> | void;
}) {
  const [state, setState] = useState<ImporterState>({ status: "idle" });
  const cancelled = useRef(false);

  const start = useCallback(async (files: File[]) => {
    cancelled.current = false;
    const fileName = files.length === 1 ? files[0].name : `${files.length} images`;
    setState({ status: "working", fileName, progress: { stage: "reading", done: 0, total: files.length } });
    try {
      const result = await importFiles(files, (progress) => {
        if (cancelled.current) throw new DOMException("Import cancelled", "AbortError");
        setState({ status: "working", fileName, progress });
      });
      if (cancelled.current) return;
      setState({ status: "working", fileName, progress: { stage: "saving", done: result.slides.length, total: result.slides.length } });
      await onImported(result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ status: "idle" });
        return;
      }
      if (!(error instanceof ImportError)) console.error("[cueframe] import failed", error);
      const message = error instanceof ImportError || (error instanceof Error && error.message && !(error instanceof TypeError))
        ? error.message
        : "This file couldn't be imported. Try exporting it again as PDF.";
      setState({ status: "error", message });
    }
  }, [onImported]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    setState({ status: "idle" });
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, start, cancel, reset };
}
