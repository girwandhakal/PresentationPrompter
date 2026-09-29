"use client";

import Link from "next/link";
import { useState } from "react";
import { NewPresentation } from "../../../components/import/NewPresentation";
import { ProjectMenu } from "../../../components/project/ProjectMenu";
import { SlideImage } from "../../../components/project/SlideImage";
import { projectStatus } from "../../../components/shell/Sidebar";
import { Skeleton } from "../../../components/ui/controls";
import { RevealWords } from "../../../components/ui/motion";
import { formatRelative } from "@/lib/domain/format";
import { projectHref } from "@/lib/domain/planner";
import { useProjects } from "@/lib/store/projects";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function HomePage() {
  const { projects, ready, firstSync } = useProjects();
  useDocumentTitle("Home");
  // The first import adds a project before the redirect to setup lands; keep the import screen up
  // until then instead of flashing the library.
  const [importing, setImporting] = useState(false);

  // On a device new to this account, an empty library may still be filling; don't offer an import yet.
  if (!ready || (!projects.length && firstSync)) {
    return (
      <div className="page">
        <Skeleton width={280} height={36} />
        <div style={{ height: 24 }} />
        <Skeleton width="100%" height={260} radius={20} />
      </div>
    );
  }

  if (!projects.length || importing) {
    return (
      <div className="page page--narrow home-empty stagger">
        <h1 className="page-title"><RevealWords text="Import your slides" /></h1>
        <p className="page-lede">Cueframe generates your script for you.</p>
        <NewPresentation onCreating={() => setImporting(true)} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="home-header">
        <h1 className="page-title">Your presentations</h1>
      </header>
      <div className="home-grid stagger">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <Link href={projectHref(project)} className="project-card__link">
              <SlideImage slide={project.slides[0]} aspectRatio={project.aspectRatio} size="thumb" className="project-card__thumb" />
              <div className="project-card__body">
                <p className="project-card__title">{project.title}</p>
                <p className="project-card__meta">
                  <span>{projectStatus(project)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelative(project.updatedAt)}</span>
                </p>
              </div>
            </Link>
            {/* A sibling of the link, not inside it: a button can't live in a link. */}
            <div className="project-card__menu">
              <ProjectMenu project={project} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
