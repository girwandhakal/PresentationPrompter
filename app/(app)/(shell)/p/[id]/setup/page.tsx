"use client";

import { ProjectRoute } from "../../../../../components/project/ProjectRoute";
import { SetupView } from "../../../../../components/setup/SetupView";
import { useDocumentTitle } from "@/lib/use-document-title";

function Title({ title }: { title: string }) {
  useDocumentTitle(`Setup · ${title}`);
  return null;
}

export default function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectRoute params={params}>
      {(project) => (
        <>
          <Title title={project.title} />
          <SetupView key={project.id} project={project} />
        </>
      )}
    </ProjectRoute>
  );
}
