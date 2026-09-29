"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { createProject } from "@/lib/domain/factory";
import type { ImportResult } from "@/lib/import";
import { getPref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { Button } from "../ui/button";
import { Callout } from "../ui/controls";
import { DeckDropzone } from "./DeckDropzone";
import { ImportProgressCard } from "./ImportProgressCard";
import { useImporter } from "./use-importer";

/** Import step of the create flow: file → slides saved locally → setup form. */
export function NewPresentation({ onCreating }: { onCreating?: () => void } = {}) {
  const router = useRouter();
  const { create } = useProjects();

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
    // Saving adds the first project, which can swap this screen out from under the redirect below.
    onCreating?.();
    await create(project, result.blobs);
    router.push(`/p/${project.id}/setup`);
  }, [create, onCreating, router]);

  const { state, start, cancel, reset } = useImporter({ onImported });

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
