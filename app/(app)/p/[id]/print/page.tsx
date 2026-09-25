"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { ScriptText } from "../../../../components/presenter/ScriptText";
import { ProjectRoute } from "../../../../components/project/ProjectRoute";
import { SlideImage } from "../../../../components/project/SlideImage";
import { Button } from "../../../../components/ui/button";
import { formatClock } from "@/lib/domain/format";
import { slideSpokenSeconds } from "@/lib/domain/planner";
import type { Project } from "@/lib/domain/types";
import { useDocumentTitle } from "@/lib/use-document-title";

function PrintView({ project }: { project: Project }) {
  useDocumentTitle(`${project.title} — script`);
  useEffect(() => {
    // Give slide thumbnails a moment to load before opening the print dialog.
    const timer = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="print-page">
      <header className="print-page__header">
        <div>
          <h1>{project.title}</h1>
          <p>{project.brief.goal}</p>
          <p className="print-page__meta">{project.slides.length} slides · {project.brief.minutes} min at {project.brief.wpm} wpm</p>
        </div>
        <Button className="print-page__button" variant="primary" icon={<Printer />} onClick={() => window.print()}>Print</Button>
      </header>
      {project.slides.map((slide, index) => (
        <section key={slide.id} className="print-slide">
          <div className="print-slide__aside">
            <SlideImage slide={slide} aspectRatio={project.aspectRatio} size="thumb" priority />
            <p className="print-slide__meta">{index + 1}. {slide.title}<br />about {formatClock(slideSpokenSeconds(slide, project.brief.wpm))}</p>
          </div>
          <div className="print-slide__script">
            <ScriptText script={slide.script} />
            {slide.script.transition && <p className="print-slide__transition">→ {slide.script.transition}</p>}
          </div>
        </section>
      ))}
    </main>
  );
}

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectRoute params={params}>{(project) => <PrintView project={project} />}</ProjectRoute>;
}
