"use client";

import { Overview } from "../../../../components/project/Overview";
import { ProjectRoute } from "../../../../components/project/ProjectRoute";
import { useDocumentTitle } from "@/lib/use-document-title";

function Title({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectRoute params={params}>
      {(project) => (
        <>
          <Title title={project.title} />
          <Overview key={project.id} project={project} />
        </>
      )}
    </ProjectRoute>
  );
}
