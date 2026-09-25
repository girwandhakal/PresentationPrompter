"use client";

import { ArrowLeft, ArrowRight, BarChart3, CircleAlert, PenLine, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { documentCues, documentToWordCount, wordsToSeconds } from "@/lib/domain/script";
import { formatClock, formatDuration, formatRelative, pluralize } from "@/lib/domain/format";
import { hasScript, planPresentation, projectSpokenSeconds } from "@/lib/domain/planner";
import type { Project } from "@/lib/domain/types";
import { ScriptText } from "../presenter/ScriptText";
import { Button, ButtonLink, IconButton } from "../ui/button";
import { EmptyState, Segmented } from "../ui/controls";
import { ProjectMenu } from "./ProjectMenu";
import { SlideImage } from "./SlideImage";

/** At-a-glance view of a presentation: the deck, the script, timing, and the way into Presenter. */
export function Overview({ project }: { project: Project }) {
  const router = useRouter();
  const scripted = hasScript(project);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"script" | "presenter">("script");
  const plan = useMemo(() => planPresentation(project.brief, project.slides), [project]);
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

  const spoken = projectSpokenSeconds(project);
  const words = documentToWordCount(slide.script.document);
  const slideSeconds = wordsToSeconds(words, project.brief.wpm);
  const cues = documentCues(slide.script.document).length;
  const flags = slide.script.flags.filter((flag) => flag.kind !== "over-budget" && flag.kind !== "under-budget");
  const generating = project.generation.status === "running";

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__titles">
          <h1 className="overview__title">{project.title}</h1>
          <p className="overview__meta tabular">
            {pluralize(project.slides.length, "slide")} · {formatDuration(spoken)} of {formatDuration(plan.speakingSeconds)} planned
            {project.lastPresentedAt ? ` · presented ${formatRelative(project.lastPresentedAt).toLowerCase()}` : ""}
          </p>
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
          <SlideImage slide={slide} aspectRatio={project.aspectRatio} priority />
          <div className="overview__nav">
            <IconButton label="Previous slide" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}><ArrowLeft /></IconButton>
            <span className="tabular">{index + 1} / {project.slides.length}</span>
            <IconButton label="Next slide" onClick={() => setIndex(Math.min(project.slides.length - 1, index + 1))} disabled={index === project.slides.length - 1}><ArrowRight /></IconButton>
          </div>
          <ol className="filmstrip" aria-label="All slides">
            {project.slides.map((item, position) => (
              <li key={item.id}>
                <button type="button" className="filmstrip__item" aria-current={position === index ? "true" : undefined} onClick={() => setIndex(position)} aria-label={`Slide ${position + 1}: ${item.title}`}>
                  <SlideImage slide={item} aspectRatio={project.aspectRatio} size="thumb" />
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
              <h2 className="overview__slide-title">{slide.title}</h2>
            </div>
            <Segmented size="sm" label="View" value={view} onChange={setView} options={[{ value: "script", label: "Script" }, { value: "presenter", label: "Presenter" }]} />
          </div>
          {slide.script.purpose && <p className="overview__purpose">{slide.script.purpose}</p>}

          {words === 0 ? (
            <EmptyState title="No script for this slide" action={<Button variant="secondary" size="sm" onClick={() => router.push(`/p/${project.id}/edit?slide=${slide.id}`)}>Write it</Button>} />
          ) : view === "script" ? (
            <ScriptText className="overview__text" script={slide.script} />
          ) : (
            <div className="presenter-preview theme-dark overview__preview"><ScriptText script={slide.script} /></div>
          )}

          {flags.length > 0 && (
            <p className="overview__flag"><CircleAlert aria-hidden="true" /> {flags.length === 1 ? flags[0].message : `${flags.length} notes to review on this slide.`}</p>
          )}

          <dl className="overview__stats tabular">
            <div><dt>Spoken</dt><dd>{formatClock(slideSeconds)}</dd></div>
            <div><dt>Plan</dt><dd>{slide.optional ? "—" : formatClock(plan.slides[index]?.seconds ?? 0)}</dd></div>
            <div><dt>Words</dt><dd>{words}</dd></div>
            <div><dt>Cues</dt><dd>{cues}</dd></div>
          </dl>
          <ButtonLink href={`/p/${project.id}/edit?slide=${slide.id}`} variant="ghost" size="sm" icon={<PenLine />}>Edit this slide</ButtonLink>
        </aside>
      </div>
    </div>
  );
}
