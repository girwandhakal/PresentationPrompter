"use client";

import { FileQuestion } from "lucide-react";
import { use, type ReactNode } from "react";
import type { Project } from "@/lib/domain/types";
import { useProjects } from "@/lib/store/projects";
import { ButtonLink } from "../ui/button";
import { EmptyState, Spinner } from "../ui/controls";

/** Resolves `/p/[id]` params to a project and renders loading and not-found states consistently. */
export function ProjectRoute({ params, children }: { params: Promise<{ id: string }>; children: (project: Project) => ReactNode }) {
  const { id } = use(params);
  const { get, ready } = useProjects();
  const project = get(id);
  if (!ready) return <div className="center-state"><Spinner label="Loading presentation" size={22} /></div>;
  if (!project) {
    return (
      <div className="center-state">
        <EmptyState icon={<FileQuestion />} title="This presentation isn't here" action={<ButtonLink href="/" variant="primary">Go to your presentations</ButtonLink>}>
          It may have been deleted, or it was created in a different browser. Presentations are stored only in the browser where you made them.
        </EmptyState>
      </div>
    );
  }
  return <>{children(project)}</>;
}
