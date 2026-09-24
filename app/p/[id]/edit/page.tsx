"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { ScriptEditor } from "../../../components/workspace/ScriptEditor";
import { WorkspaceShell } from "../../../components/workspace/WorkspaceShell";
import { usePresentations } from "../../../components/workspace/use-presentations";

export default function EditPresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { getPresentation, ready } = usePresentations();
  const presentation = getPresentation(id);

  useEffect(() => {
    if (ready && !presentation) router.replace("/");
  }, [ready, presentation, router]);

  if (!presentation) return null;

  return (
    <WorkspaceShell activeId={id}>
      {/* Remounts once ready flips true so the editor's local state (seeded once from
          `presentation.slides` on mount) picks up real localStorage data instead of getting
          stuck on the mock-data snapshot used for the first, pre-hydration paint. */}
      <ScriptEditor key={`${presentation.id}-${ready}`} presentation={presentation} />
    </WorkspaceShell>
  );
}
