"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { createProject } from "@/lib/domain/factory";
import { readBackup } from "@/lib/export";
import type { ImportResult } from "@/lib/import";
import { getPref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { Button } from "../ui/button";
import { Callout } from "../ui/controls";
import { useToast } from "../ui/toast";
import { DeckDropzone } from "./DeckDropzone";
import { ImportProgressCard } from "./ImportProgressCard";
import { useImporter } from "./use-importer";

/** Import step of the create flow: file → slides saved locally → setup form. */
export function NewPresentation() {
  const router = useRouter();
  const toast = useToast();
  const { create, projects } = useProjects();

  const onImported = useCallback(async (result: ImportResult) => {
    const project = createProject({
      title: result.title,
      fileName: result.fileName,
      kind: result.kind,
      bytes: result.bytes,
      aspectRatio: result.aspectRatio,
      slides: result.slides,
      brief: getPref("defaultBrief"),
    });
    await create(project, result.blobs);
    router.push(`/p/${project.id}/setup`);
  }, [create, router]);

  const onBackup = useCallback(async (file: File) => {
    const restored = await readBackup(file, new Set(projects.map((project) => project.id)));
    for (const entry of restored) await create(entry.project, entry.blobs);
    toast(restored.length === 1 ? `Restored “${restored[0].project.title}”` : `Restored ${restored.length} presentations`);
    router.push(`/p/${restored[0].project.id}`);
  }, [create, projects, router, toast]);

  const { state, start, cancel, reset } = useImporter({ onImported, onBackup });

  if (state.status === "working") return <ImportProgressCard state={state} onCancel={cancel} />;

  return (
    <div className="new-presentation">
      {state.status === "error" && (
        <Callout tone="error" title="That file couldn't be imported" action={<Button size="sm" variant="ghost" onClick={reset}>Dismiss</Button>}>
          {state.message}
        </Callout>
      )}
      <DeckDropzone onFiles={start} />
    </div>
  );
}
