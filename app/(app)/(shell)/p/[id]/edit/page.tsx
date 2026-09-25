"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScriptEditor } from "../../../../../components/editor/ScriptEditor";
import { ProjectRoute } from "../../../../../components/project/ProjectRoute";
import type { Project } from "@/lib/domain/types";
import { useDocumentTitle } from "@/lib/use-document-title";

function Editor({ project }: { project: Project }) {
  const search = useSearchParams();
  useDocumentTitle(`Script · ${project.title}`);
  return <ScriptEditor key={project.id} project={project} initialSlideId={search.get("slide")} />;
}

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectRoute params={params}>
      {(project) => (
        <Suspense>
          <Editor project={project} />
        </Suspense>
      )}
    </ProjectRoute>
  );
}
