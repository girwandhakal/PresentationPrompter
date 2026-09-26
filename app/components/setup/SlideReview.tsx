"use client";

import { AlertTriangle, ArrowDown, ArrowUp, EyeOff, MoreHorizontal, Trash2, Eye } from "lucide-react";
import { m, useDragControls, type DragControls, type HTMLMotionProps, type PanInfo } from "motion/react";
import { useRef, useState, type ReactNode, type Ref } from "react";
import { hasScript } from "@/lib/domain/planner";
import type { Project, Slide } from "@/lib/domain/types";
import { releaseBlobUrls } from "@/lib/store/blob-url";
import { deleteBlobs } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { SlideImage } from "../project/SlideImage";
import { IconButton } from "../ui/button";
import { GLIDE, SPRING } from "../ui/motion";
import { Menu } from "../ui/menu";
import { useToast } from "../ui/toast";

/**
 * Import review: confirm order, drop slides that shouldn't be scripted, mark optional ones, and see
 * import warnings. Reorder works by drag or from each slide's menu (keyboard-friendly).
 *
 * Dragging is Motion's drag + layout (Reorder's technique, in two dimensions): the held card follows
 * the pointer while everything else holds still. Resting on a slide (or dropping on it) opens a space
 * there: the cards in between glide one slot aside. Passing quickly over slides moves nothing. The
 * order is saved once, on release.
 *
 * A mouse picks a card up immediately. Touch needs a short press-and-hold first, so an ordinary swipe
 * over the grid still scrolls the page.
 */
const DWELL_MS = 150;
const HOLD_MS = 260;
export function SlideReview({ project }: { project: Project }) {
  const { update, saveVersion } = useProjects();
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  // While dragging, the live order is local; it's committed to the project on release.
  const [order, setOrder] = useState<string[] | null>(null);
  const grid = useRef<HTMLOListElement>(null);
  const hover = useRef<{ id: string; timer: number } | null>(null);
  // Moving a card in the DOM restarts its CSS animations, so the entrance runs only until the first
  // reorder; after that a moved card would blink out and fade back in.
  const [settled, setSettled] = useState(false);
  const cards = useRef(new Map<string, HTMLLIElement>());
  const slides = project.slides;
  const byId = new Map(slides.map((slide) => [slide.id, slide]));
  const ordered = order ? order.flatMap((id) => byId.get(id) ?? []) : slides;

  const setSlides = (next: Slide[]) => update(project.id, (current) => ({ ...current, slides: next }));

  function move(id: string, delta: number) {
    const index = slides.findIndex((slide) => slide.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSettled(true);
    void setSlides(next);
  }

  /** Moves `id` into `targetId`'s place within the live drag order. */
  function openSpace(id: string, targetId: string) {
    setOrder((current) => {
      if (!current) return current;
      const from = current.indexOf(id);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }

  function clearHover() {
    if (hover.current) window.clearTimeout(hover.current.timer);
    hover.current = null;
  }

  function onDrag(id: string, info: PanInfo) {
    const list = grid.current;
    if (!list) return;
    const box = list.getBoundingClientRect();
    const clientY = info.point.y - window.scrollY;
    // Keep the pointer's slot in view when the grid scrolls.
    if (clientY < box.top + 48) list.scrollTop -= 12;
    else if (clientY > box.bottom - 48) list.scrollTop += 12;
    // Hit-test against untransformed layout boxes (offset*), so cards that are mid-glide can't make
    // the target flicker back and forth.
    const x = info.point.x - window.scrollX - box.left + list.scrollLeft;
    const y = clientY - box.top + list.scrollTop;
    let target: string | null = null;
    for (const [otherId, card] of cards.current) {
      if (otherId === id) continue;
      if (x >= card.offsetLeft && x <= card.offsetLeft + card.offsetWidth && y >= card.offsetTop && y <= card.offsetTop + card.offsetHeight) {
        target = otherId;
        break;
      }
    }
    if (target === hover.current?.id) return;
    clearHover();
    if (!target) return;
    const over = target;
    hover.current = { id: over, timer: window.setTimeout(() => { hover.current = null; openSpace(id, over); }, DWELL_MS) };
  }

  function endDrag() {
    const id = dragId;
    const pending = hover.current?.id;
    clearHover();
    let final = order;
    // Dropping straight onto a slide counts, even before the dwell opened a space.
    if (final && id && pending) {
      final = final.filter((item) => item !== id);
      final.splice(order!.indexOf(pending), 0, id);
    }
    if (final && final.some((item, index) => slides[index]?.id !== item)) void setSlides(final.flatMap((item) => byId.get(item) ?? []));
    setOrder(null);
    setDragId(null);
  }

  async function remove(slide: Slide) {
    if (slides.length <= 1) {
      toast("A presentation needs at least one slide.");
      return;
    }
    if (hasScript(project)) await saveVersion(project.id, `Before removing “${slide.title}”`);
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
      <m.ol ref={grid} layoutScroll className="slide-review__grid" data-settled={settled || undefined} aria-label="Slides in presentation order">
        {ordered.map((slide, index) => {
          const issues = slide.warnings.filter((warning) => warning.kind !== "approximate-render");
          return (
            <DraggableCard
              key={slide.id}
              ref={(node) => { if (node) cards.current.set(slide.id, node); else cards.current.delete(slide.id); }}
              className="review-slide"
              data-optional={slide.optional}
              data-dragging={dragId === slide.id}
              style={{ "--i": index, zIndex: dragId === slide.id ? 5 : 0 } as React.CSSProperties}
              layout
              transition={GLIDE}
              onContextMenu={(event) => { if (dragId) event.preventDefault(); }}
              dragSnapToOrigin
              dragMomentum={false}
              dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
              whileDrag={{ scale: 1.05, transition: SPRING }}
              onDragStart={() => {
                setSettled(true);
                setDragId(slide.id);
                setOrder(slides.map((item) => item.id));
              }}
              onDrag={(_, info) => onDrag(slide.id, info)}
              onDragEnd={endDrag}
            >
              <div className="review-slide__inner">
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
              </div>
            </DraggableCard>
          );
        })}
      </m.ol>
    </div>
  );
}

/** Mouse: drag at once. Touch: only after a still hold, so a normal swipe keeps scrolling the page. */
function pressToDrag(event: React.PointerEvent<HTMLLIElement>, controls: DragControls) {
  if (event.button !== 0 || (event.target as HTMLElement).closest("button, a, [data-tooltip]")) return;
  if (event.pointerType === "mouse") {
    controls.start(event);
    return;
  }
  const card = event.currentTarget;
  const origin = event.nativeEvent;
  const move = (next: PointerEvent) => { if (Math.hypot(next.clientX - origin.clientX, next.clientY - origin.clientY) > 8) cancel(); };
  const cancel = () => {
    window.clearTimeout(timer);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", cancel);
    window.removeEventListener("pointercancel", cancel);
  };
  const timer = window.setTimeout(() => {
    cancel();
    // From here the gesture is a drag: stop the page scrolling until the finger lifts.
    const block = (touch: TouchEvent) => touch.preventDefault();
    const release = () => {
      card.removeEventListener("touchmove", block);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    card.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    navigator.vibrate?.(10);
    controls.start(origin);
  }, HOLD_MS);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", cancel);
  window.addEventListener("pointercancel", cancel);
}

/** A grid card that owns its drag controls, so the drag starts from pressToDrag rather than on touch. */
function DraggableCard({ children, ref, ...props }: Omit<HTMLMotionProps<"li">, "drag" | "dragControls" | "dragListener" | "onPointerDown" | "children"> & { children: ReactNode; ref?: Ref<HTMLLIElement> }) {
  const controls = useDragControls();
  return (
    <m.li ref={ref} {...props} drag dragControls={controls} dragListener={false} onPointerDown={(event) => pressToDrag(event, controls)}>
      {children}
    </m.li>
  );
}
