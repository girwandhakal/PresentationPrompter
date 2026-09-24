"use client";

import { PresenterView } from "../../../../components/presenter/PresenterView";
import { ProjectRoute } from "../../../../components/project/ProjectRoute";
import { useDocumentTitle } from "@/lib/use-document-title";

function Title({ title }: { title: string }) {
  useDocumentTitle(`Private presenter · ${title}`);
  return null;
}

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectRoute params={params}>
      {(project) => (
        <>
          <Title title={project.title} />
          <PresenterView key={project.id} project={project} />
        </>
      )}
    </ProjectRoute>
  );
}
