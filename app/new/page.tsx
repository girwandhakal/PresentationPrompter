"use client";

import { useRouter } from "next/navigation";
import { NewPresentationFlow } from "../components/workspace/NewPresentationFlow";
import { WorkspaceShell } from "../components/workspace/WorkspaceShell";
import { usePresentations } from "../components/workspace/use-presentations";
import type { Presentation } from "../components/workspace/types";

export default function NewPresentationPage() {
  const router = useRouter();
  const { addPresentation } = usePresentations();

  function handleGenerated(presentation: Presentation) {
    addPresentation(presentation);
    router.push(`/p/${presentation.id}`);
  }

  return (
    <WorkspaceShell>
      <NewPresentationFlow onGenerated={handleGenerated} />
    </WorkspaceShell>
  );
}
