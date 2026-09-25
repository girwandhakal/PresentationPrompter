"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { PresentationWorkspace } from "../../components/workspace/PresentationWorkspace";
import { WorkspaceShell } from "../../components/workspace/WorkspaceShell";
import { usePresentations } from "../../components/workspace/use-presentations";

export default function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
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
      <PresentationWorkspace presentation={presentation} />
    </WorkspaceShell>
  );
}
