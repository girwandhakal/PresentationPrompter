"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProjectRoute } from "../../../../../components/project/ProjectRoute";
import { SessionReview } from "../../../../../components/project/SessionReview";
import type { Project } from "@/lib/domain/types";
import { useDocumentTitle } from "@/lib/use-document-title";

function Review({ project }: { project: Project }) {
  const search = useSearchParams();
  useDocumentTitle(`Review · ${project.title}`);
  return <SessionReview project={project} sessionId={search.get("session")} />;
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectRoute params={params}>
      {(project) => <Suspense><Review key={project.id} project={project} /></Suspense>}
    </ProjectRoute>
  );
}
