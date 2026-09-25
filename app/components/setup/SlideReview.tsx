"use client";

import { AlertTriangle, ArrowDown, ArrowUp, EyeOff, MoreHorizontal, Trash2, Eye } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import type { Project, Slide } from "@/lib/domain/types";
import { releaseBlobUrls } from "@/lib/store/blob-url";
import { deleteBlobs } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { SlideImage } from "../project/SlideImage";
import { IconButton } from "../ui/button";
import { SPRING } from "../ui/motion";
import { Menu } from "../ui/menu";
import { useToast } from "../ui/toast";

/**
 * Import review: confirm order, drop slides that shouldn't be scripted, mark optional ones, and see
 * import warnings. Reorder works by drag or from each slide's menu (keyboard-friendly).
 */
export function SlideReview({ project }: { project: Project }) {
  const { update } = useProjects();
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const slides = project.slides;

  const setSlides = (next: Slide[]) => update(project.id, (current) => ({ ...current, slides: next }));

  function move(id: string, delta: number) {
    const index = slides.findIndex((slide) => slide.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void setSlides(next);
  }

  function moveTo(id: string, beforeId: string) {
    if (id === beforeId) return;
    const next = slides.filter((slide) => slide.id !== id);
    const item = slides.find((slide) => slide.id === id)!;
    const index = next.findIndex((slide) => slide.id === beforeId);
    next.splice(index < 0 ? next.length : index, 0, item);
    void setSlides(next);
  }

  async function remove(slide: Slide) {
    if (slides.length <= 1) {
      toast("A presentation needs at least one slide.");
      return;
    }
    await setSlides(slides.filter((item) => item.id !== slide.id));
    void deleteBlobs([slide.imageKey, slide.thumbKey]);
    releaseBlobUrls([slide.imageKey, slide.thumbKey]);
    toast(`Removed slide “${slide.title}”`);
  }

  const toggleOptional = (slide: Slide) =>
    setSlides(slides.map((item) => item.id === slide.id ? { ...item, optional: !item.optional } : item));

  const warnings = slides.filter((slide) => slide.warnings.some((warning) => warning.kind !== "sparse-text" && warning.kind !== "approximate-render"));

  return (
    <div className="slide-review">
      {project.source.kind === "pptx" && (
        <p className="slide-review__note">
          PowerPoint slides are shown as simplified previews. For exact visuals in the audience window, export the deck as PDF and use <em>Replace slides</em>; your script will carry over.
        </p>
      )}
      {warnings.length > 0 && (
        <p className="slide-review__note">
          <AlertTriangle aria-hidden="true" /> {warnings.length === 1 ? "One slide has" : `${warnings.length} slides have`} content that doesn&apos;t carry over (animations, video, or charts). Hover the marker for details.
        </p>
      )}
      <ol className="slide-review__grid" aria-label="Slides in presentation order">
        {slides.map((slide, index) => {
          const issues = slide.warnings.filter((warning) => warning.kind !== "approximate-render");
          return (
            <li
              key={slide.id}
              className="review-slide"
              data-optional={slide.optional}
              data-dragging={dragId === slide.id}
              data-over={overId === slide.id && dragId !== slide.id}
              style={{ "--i": index } as React.CSSProperties}
              draggable
              onDragStart={(event) => {
                setDragId(slide.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", slide.id);
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                setOverId(slide.id);
              }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) moveTo(dragId, slide.id);
                setDragId(null);
                setOverId(null);
              }}
            >
              {/* Reordering glides each card to its new place instead of jumping. */}
              <m.div layout="position" transition={SPRING} className="review-slide__inner">
                <div className="review-slide__thumb">
                  <SlideImage slide={slide} aspectRatio={project.aspectRatio} size="thumb" />
                  <span className="review-slide__number tabular">{index + 1}</span>
                  {slide.optional && <span className="review-slide__badge">Optional</span>}
                  {issues.length > 0 && (
                    <span className="review-slide__warning" data-tooltip={issues.map((warning) => warning.message).join(" ")} data-tooltip-side="top" tabIndex={0} aria-label={`Import note: ${issues.map((warning) => warning.message).join(" ")}`}>
                      <AlertTriangle />
                    </span>
                  )}
                </div>
                <div className="review-slide__footer">
                  <span className="review-slide__title" title={slide.title}>{slide.title}</span>
                  <Menu
                    label={`Actions for slide ${index + 1}`}
                    align="end"
                    items={[
                      { label: slide.optional ? "Include in timing" : "Mark optional", icon: slide.optional ? <Eye /> : <EyeOff />, onSelect: () => toggleOptional(slide) },
                      { label: "Move earlier", icon: <ArrowUp />, disabled: index === 0, onSelect: () => move(slide.id, -1) },
                      { label: "Move later", icon: <ArrowDown />, disabled: index === slides.length - 1, onSelect: () => move(slide.id, 1) },
                      { type: "separator" },
                      { label: "Remove slide", icon: <Trash2 />, tone: "danger", onSelect: () => remove(slide) },
                    ]}
                    trigger={(props) => <IconButton {...props} label={`Actions for slide ${index + 1}`} size="sm" tooltip={false}><MoreHorizontal /></IconButton>}
                  />
                </div>
              </m.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
