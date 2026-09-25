"use client";

import Link from "next/link";
import { NewPresentation } from "../../components/import/NewPresentation";
import { SlideImage } from "../../components/project/SlideImage";
import { projectStatus } from "../../components/shell/Sidebar";
import { Skeleton } from "../../components/ui/controls";
import { RevealWords } from "../../components/ui/motion";
import { formatRelative } from "@/lib/domain/format";
import { useProjects } from "@/lib/store/projects";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function HomePage() {
  const { projects, ready } = useProjects();
  useDocumentTitle("Home");

  if (!ready) {
    return (
      <div className="page">
        <Skeleton width={280} height={36} />
        <div style={{ height: 24 }} />
        <Skeleton width="100%" height={260} radius={20} />
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="page page--narrow home-empty stagger">
        <p className="eyebrow">Cueframe</p>
        <h1 className="page-title"><RevealWords text="Bring the deck you already made." /></h1>
        <p className="page-lede">
          Cueframe reads your slides, writes a script that sounds like you, and gives you a private teleprompter while your audience sees only the slides.
        </p>
        <NewPresentation offerSample />
        <ol className="home-steps stagger" aria-label="How it works">
          <li><strong>Import</strong><span>PDF gives exact visuals. PowerPoint and images work too.</span></li>
          <li><strong>Brief</strong><span>Tell it your goal, audience, and how long you have.</span></li>
          <li><strong>Present</strong><span>Open the slides for the room. Keep the script for yourself.</span></li>
        </ol>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="home-header">
        <h1 className="page-title">Your presentations</h1>
      </header>
      <div className="home-grid stagger">
        <div className="home-grid__new">
          <NewPresentation compact />
        </div>
        {projects.map((project) => (
          <Link key={project.id} href={`/p/${project.id}`} className="project-card">
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
        ))}
      </div>
    </div>
  );
}
