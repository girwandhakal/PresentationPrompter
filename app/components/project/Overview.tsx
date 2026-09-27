"use client";

import { ArrowLeft, ArrowRight, BarChart3, PenLine, Play } from "lucide-react";
import { m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { documentToWordCount } from "@/lib/domain/script";
import { hasScript } from "@/lib/domain/planner";
import type { Project } from "@/lib/domain/types";
import { ScriptText } from "../presenter/ScriptText";
import { Button, ButtonLink, IconButton } from "../ui/button";
import { EmptyState, Segmented } from "../ui/controls";
import { GLIDE, RollingText } from "../ui/motion";
import { ProjectMenu } from "./ProjectMenu";
import { SlideImage } from "./SlideImage";

/** At-a-glance view of a presentation: the deck, the script, timing, and the way into Presenter. */
export function Overview({ project }: { project: Project }) {
  const router = useRouter();
  const scripted = hasScript(project);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"script" | "presenter">("script");
  const strip = useRef<HTMLOListElement>(null);

  // Keep the selected thumbnail (and its ring) fully in view. Only the strip scrolls, never the page.
  useEffect(() => {
    const list = strip.current;
    const item = list?.children[index] as HTMLElement | undefined;
    if (!list || !item) return;
    const edge = 8;
    const box = list.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (rect.left < box.left + edge) list.scrollBy({ left: rect.left - box.left - edge, behavior });
    else if (rect.right > box.right - edge) list.scrollBy({ left: rect.right - box.right + edge, behavior });
  }, [index]);
  const slide = project.slides[Math.min(index, project.slides.length - 1)];

  useEffect(() => {
    if (!scripted && project.status === "setup") router.replace(`/p/${project.id}/setup`);
  }, [project.id, project.status, router, scripted]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true'], [role='menu']")) return;
      if (event.key === "ArrowRight") setIndex((value) => Math.min(project.slides.length - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project.slides.length]);

  if (!slide) return null;

  const words = documentToWordCount(slide.script.document);
  const generating = project.generation.status === "running";

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__titles">
          <h1 className="overview__title">{project.title}</h1>
        </div>
        <div className="overview__actions">
          <ProjectMenu project={project} />
          {project.lastPresentedAt && <ButtonLink href={`/p/${project.id}/review`} variant="ghost" size="sm" icon={<BarChart3 />} className="hide-narrow">Last session</ButtonLink>}
          <ButtonLink href={`/p/${project.id}/edit?slide=${slide.id}`} variant="secondary" icon={<PenLine />}>Edit script</ButtonLink>
          <ButtonLink href={`/p/${project.id}/present`} variant="accent" icon={<Play />}>Present</ButtonLink>
        </div>
      </header>

      {generating && (
        <p className="overview__banner" role="status">A new draft is being written. It will replace this script when it&apos;s ready.</p>
      )}

      <div className="overview__body">
        <section className="overview__stage" aria-label="Slides">
          <SlideImage key={slide.id} slide={slide} aspectRatio={project.aspectRatio} priority className="overview__slide" />
          <div className="overview__nav">
            <IconButton label="Previous slide" tooltip={false} onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}><ArrowLeft /></IconButton>
            <span className="tabular"><RollingText value={String(index + 1)} /> / {project.slides.length}</span>
            <IconButton label="Next slide" tooltip={false} onClick={() => setIndex(Math.min(project.slides.length - 1, index + 1))} disabled={index === project.slides.length - 1}><ArrowRight /></IconButton>
          </div>
          <ol ref={strip} className="filmstrip" aria-label="All slides">
            {project.slides.map((item, position) => (
              <li key={item.id}>
                <button type="button" className="filmstrip__item" aria-current={position === index ? "true" : undefined} onClick={() => setIndex(position)} aria-label={`Slide ${position + 1}: ${item.title}`}>
                  <SlideImage slide={item} aspectRatio={project.aspectRatio} size="thumb" />
                  {position === index && <m.span layoutId="filmstrip-current" className="filmstrip__ring" transition={GLIDE} aria-hidden="true" />}
                  <span className="filmstrip__number tabular">{position + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <aside className="overview__script" aria-label={`Script for slide ${index + 1}`}>
          <div className="overview__script-head">
            <div>
              <p className="eyebrow tabular">Slide {index + 1}{slide.optional ? " · Optional" : ""}</p>
              <h2 className="overview__slide-title" key={slide.id}>{slide.title}</h2>
            </div>
            <Segmented size="sm" label="View" value={view} onChange={setView} options={[{ value: "script", label: "Script" }, { value: "presenter", label: "Presenter" }]} />
          </div>

          {project.generationQuality?.warnings.find((entry) => entry.id === slide.id)?.issues.length ? (
            <details>
              <summary>Review notes for this draft</summary>
              <ul>{project.generationQuality.warnings.find((entry) => entry.id === slide.id)!.issues.map((issue, position) => <li key={position}>{issue.message}</li>)}</ul>
            </details>
          ) : null}
          {project.generationQuality?.delivery.find((entry) => entry.id === slide.id)?.mode === "fallback" && <p className="text-muted">Basic delivery cues are shown. The delivery coach was unavailable.</p>}

          {words === 0 ? (
            <EmptyState title="No script for this slide" action={<Button variant="secondary" size="sm" onClick={() => router.push(`/p/${project.id}/edit?slide=${slide.id}`)}>Write it</Button>} />
          ) : (
            // Both views share one grid cell and crossfade, so the card keeps the taller view's height
            // and switching never changes the page's length.
            <div className="overview__views">
              <div className="overview__view" data-active={view === "script"} aria-hidden={view !== "script"} inert={view !== "script"}>
                <ScriptText key={slide.id} className="overview__text" script={slide.script} />
              </div>
              <div className="overview__view" data-active={view === "presenter"} aria-hidden={view !== "presenter"} inert={view !== "presenter"}>
                <div key={slide.id} className="presenter-preview theme-dark overview__preview"><ScriptText script={slide.script} /></div>
              </div>
            </div>
          )}


        </aside>
      </div>
    </div>
  );
}
