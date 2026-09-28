"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, History, LoaderCircle, PanelRightClose, PanelRightOpen, Play, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { m } from "motion/react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiRequestError, documentFromWritten, rewriteScript, rewriteSelection, useAiStatus, type ScriptAction, type SelectionAction } from "@/lib/ai/client";
import { documentToWordCount, type ScriptDocument } from "@/lib/domain/script";
import { formatClock } from "@/lib/domain/format";
import { planPresentation, USABLE_FACTOR, DEPTH_FACTOR } from "@/lib/domain/planner";
import type { Project, Slide, SlideScript } from "@/lib/domain/types";
import { usePref } from "@/lib/prefs";
import { useProjects } from "@/lib/store/projects";
import { ScriptText } from "../presenter/ScriptText";
import { SlideImage } from "../project/SlideImage";
import { Button, ButtonLink, IconButton } from "../ui/button";
import { Menu, type MenuEntry } from "../ui/menu";
import { GLIDE, RevealWords } from "../ui/motion";
import { useToast } from "../ui/toast";
import { HistorySheet } from "./HistorySheet";
import { Inspector } from "./Inspector";
import { ScriptSurface, type ScriptSurfaceHandle } from "./ScriptSurface";

type Proposal =
  | { kind: "script"; label: string; slideId: string; document: ScriptDocument; before: number; after: number }
  | { kind: "selection"; label: string; before: string; after: string; apply: (text: string) => void };

type SaveState = "saved" | "saving" | "error";

const SELECTION_LABELS: Record<SelectionAction, string> = { shorter: "Shorter", simpler: "Simpler", conversational: "More natural", clearer: "Clearer" };

export function ScriptEditor({ project, initialSlideId }: { project: Project; initialSlideId?: string | null }) {
  const router = useRouter();
  const { update } = useProjects();
  const toast = useToast();
  const aiStatus = useAiStatus();
  const aiEnabled = Boolean(aiStatus && aiStatus.provider !== "none");
  const [inspectorOpen, setInspectorOpen] = usePref("editorInspector");

  const [slides, setSlides] = useState<Slide[]>(project.slides);
  const [activeId, setActiveId] = useState(() => project.slides.find((slide) => slide.id === initialSlideId)?.id ?? project.slides[0]?.id);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pending, setPending] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusEditor, setFocusEditor] = useState(false);
  const surface = useRef<ScriptSurfaceHandle>(null);
  const controller = useRef<AbortController | null>(null);

  const index = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
  const rail = useRef<HTMLOListElement>(null);

  // Keep the current slide in view in the rail (vertical, or horizontal on narrow layouts). Only the
  // rail scrolls, never the page.
  useEffect(() => {
    const list = rail.current;
    const item = list?.children[index] as HTMLElement | undefined;
    if (!list || !item) return;
    const edge = 8;
    const box = list.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const top = rect.top < box.top + edge ? rect.top - box.top - edge : rect.bottom > box.bottom - edge ? rect.bottom - box.bottom + edge : 0;
    const left = rect.left < box.left + edge ? rect.left - box.left - edge : rect.right > box.right - edge ? rect.right - box.right + edge : 0;
    if (top || left) list.scrollBy({ top, left, behavior });
  }, [index]);
  const active = slides[index];
  const working = useMemo(() => ({ ...project, slides }), [project, slides]);
  const plan = useMemo(() => planPresentation(project.brief, slides), [project.brief, slides]);
  const wpm = project.brief.wpm;

  // ── Persistence ─────────────────────────────────────────────────────────
  const latest = useRef(slides);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    // Typing reaches `commit` in batches; take whatever the surface is still holding first.
    surface.current?.commitPending();
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const snapshot = latest.current;
      await update(project.id, (current) => ({ ...current, slides: snapshot, status: "ready" }));
      setSaveState(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setSaveState("error");
    }
  }, [project.id, update]);

  const commit = useCallback((next: Slide[]) => {
    latest.current = next;
    dirty.current = true;
    setSlides(next);
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    const onUnload = (event: BeforeUnloadEvent) => {
      surface.current?.commitPending();
      if (!dirty.current) return;
      void flush();
      event.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void flush();
      controller.current?.abort();
    };
  }, [flush]);

  const patchSlide = useCallback((id: string, patch: (slide: Slide) => Slide) => {
    commit(latest.current.map((slide) => slide.id === id ? patch(slide) : slide));
  }, [commit]);

  const activeSlideId = active?.id;
  const patchScript = useCallback((values: Partial<SlideScript>) => {
    if (!activeSlideId) return;
    patchSlide(activeSlideId, (slide) => ({ ...slide, script: { ...slide.script, ...values, origin: slide.script.origin === "ai" ? "mixed" : slide.script.origin === "empty" ? "user" : slide.script.origin } }));
  }, [activeSlideId, patchSlide]);

  const onDocument = useCallback((document: ScriptDocument) => patchScript({ document }), [patchScript]);
  /** Every keystroke marks the page unsaved at once; the text itself arrives in batches. */
  const onEdit = useCallback(() => setSaveState("saving"), []);

  /** Reloads the working copy from the store after changes made outside the editor (History restore). */
  const resync = useCallback(async () => {
    const fresh = await update(project.id, (current) => current, { touch: false });
    if (!fresh) return;
    latest.current = fresh.slides;
    dirty.current = false;
    setSlides(fresh.slides);
    setRevision((value) => value + 1);
    setSaveState("saved");
  }, [project.id, update]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const select = useCallback((id: string) => {
    if (proposal || pending) return;
    surface.current?.commitPending();
    setActiveId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("slide", id);
    window.history.replaceState(window.history.state, "", url);
  }, [pending, proposal]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const next = latest.current[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) select(next.id);
    }
    function onSave(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onSave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onSave);
    };
  }, [flush, index, select]);

  // ── AI actions ──────────────────────────────────────────────────────────
  const words = active ? documentToWordCount(active.script.document) : 0;
  const slidePlan = plan.slides[index];
  const plannedWords = slidePlan?.words || Math.round((wpm / 60) * 45 * USABLE_FACTOR * DEPTH_FACTOR[project.brief.depth]);
  const perSecond = (wpm / 60) * DEPTH_FACTOR[project.brief.depth];

  async function runScriptAction(action: ScriptAction, label: string, targetWords: number) {
    if (!active) return;
    await flush();
    const slide = latest.current.find((item) => item.id === active.id)!;
    controller.current = new AbortController();
    setPending(label);
    try {
      const result = await rewriteScript({ ...working, slides: latest.current }, slide, action, Math.max(10, targetWords), controller.current.signal);
      const document = documentFromWritten(result);
      setProposal({ kind: "script", label, slideId: slide.id, document, before: documentToWordCount(slide.script.document), after: documentToWordCount(document) });
    } catch (error) {
      if (!controller.current?.signal.aborted) toast({ message: error instanceof AiRequestError ? error.message : "That rewrite didn't work. Try again.", tone: "error" });
    } finally {
      setPending(null);
    }
  }

  async function onSelectionRewrite(action: SelectionAction, text: string, apply: (replacement: string) => void) {
    if (!active) return;
    // The request carries the slide's paragraphs; include typing the surface hasn't reported yet.
    surface.current?.commitPending();
    controller.current = new AbortController();
    setPending(SELECTION_LABELS[action]);
    try {
      const slide = latest.current.find((item) => item.id === active.id) ?? active;
      const result = await rewriteSelection({ ...working, slides: latest.current }, slide, action, text, controller.current.signal);
      setProposal({ kind: "selection", label: SELECTION_LABELS[action], before: text, after: result.text, apply });
    } catch (error) {
      if (!controller.current?.signal.aborted) toast({ message: error instanceof AiRequestError ? error.message : "That rewrite didn't work. Try again.", tone: "error" });
    } finally {
      setPending(null);
    }
  }

  async function acceptProposal() {
    if (!proposal) return;
    if (proposal.kind === "selection") {
      proposal.apply(proposal.after);
      setProposal(null);
      return;
    }
    await flush();
    patchSlide(proposal.slideId, (slide) => ({
      ...slide,
      script: { ...slide.script, document: proposal.document, origin: "mixed" },
    }));
    setRevision((value) => value + 1);
    setProposal(null);
    toast("Rewrite applied.");
  }

  function cancelPending() {
    controller.current?.abort();
    setPending(null);
  }

  const secondsFor = (count: number) => Math.round(count / Math.max(0.5, perSecond));
  const improveItems: MenuEntry[] = [
    { type: "label", label: "Length" },
    { label: "Shorten by 15 seconds", onSelect: () => runScriptAction("fit", "Shorten by 15 seconds", words - 15 * perSecond), disabled: words < 20 },
    { label: "Shorten by 30 seconds", onSelect: () => runScriptAction("fit", "Shorten by 30 seconds", words - 30 * perSecond), disabled: words < 40 },
    { label: "Expand by 30 seconds", onSelect: () => runScriptAction("fit", "Expand by 30 seconds", words + 30 * perSecond) },
    { label: `Fit to plan (${formatClock(slidePlan?.seconds ?? 0)})`, onSelect: () => runScriptAction("fit", "Fit to plan", plannedWords), disabled: !slidePlan?.words || Math.abs(words - plannedWords) < plannedWords * 0.1 },
    { type: "separator" },
    { type: "label", label: "Voice" },
    { label: "More conversational", onSelect: () => runScriptAction("conversational", "More conversational", words || plannedWords) },
    { label: "Simpler language", onSelect: () => runScriptAction("simpler", "Simpler language", words || plannedWords) },
    { label: "Clearer transitions", onSelect: () => runScriptAction("transition", "Clearer transitions", words || plannedWords) },
    { label: "Add an example", onSelect: () => runScriptAction("example", "Add an example", (words || plannedWords) + 15) },
    { type: "separator" },
    { label: "Rewrite this slide", onSelect: () => runScriptAction("regenerate", "Rewrite this slide", plannedWords) },
  ];

  if (!active) return null;

  const empty = words === 0 && active.script.origin === "empty";
  const locked = Boolean(pending || proposal);

  return (
    <div className="editor" data-save-state={saveState}>
      <header className="page-header editor__header">
        <IconButton label="Back to overview" tooltip="bottom" onClick={() => { void flush(); router.push(`/p/${project.id}`); }}><ArrowLeft /></IconButton>
        <div className="page-header__titles">
          <span className="page-header__title">{project.title}</span>
          {saveState === "error" && <span className="page-header__subtitle" role="alert">Not saved. Retrying when you edit again.</span>}
        </div>
        <div className="page-header__actions">
          <IconButton label="History" onClick={async () => { await flush(); setHistoryOpen(true); }}><History /></IconButton>
          <ButtonLink href={`/p/${project.id}/setup`} variant="ghost" size="sm" icon={<SlidersHorizontal />} onClick={() => void flush()} className="hide-narrow">Setup</ButtonLink>
          <IconButton label={inspectorOpen ? "Hide details panel" : "Show details panel"} onClick={() => setInspectorOpen(!inspectorOpen)} className="hide-narrow">
            {inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </IconButton>
          <ButtonLink href={`/p/${project.id}/present`} variant="accent" size="sm" icon={<Play />} onClick={() => void flush()}>Present</ButtonLink>
        </div>
      </header>

      <div className="editor__body" data-inspector={inspectorOpen}>
        <nav className="editor-rail" aria-label="Slides">
          <ol ref={rail} className="editor-rail__list">
            {slides.map((slide, position) => (
              <RailItem
                key={slide.id}
                slide={slide}
                position={position}
                current={slide.id === active.id}
                disabled={locked && slide.id !== active.id}
                aspectRatio={project.aspectRatio}
                onSelect={select}
              />
            ))}
          </ol>
        </nav>

        <main className="editor-main" aria-label={`Slide ${index + 1} script`}>
          <div className="editor-main__inner">
            <div className="editor-slide-head">
              <p className="eyebrow tabular">Slide {index + 1} of {slides.length}{active.optional ? " · Optional" : ""}</p>
              <input
                className="editor-slide-head__title"
                aria-label="Slide title"
                value={active.title}
                onChange={(event) => patchSlide(active.id, (slide) => ({ ...slide, title: event.target.value }))}
              />
            </div>

            {pending && (
              <div className="ai-pending" role="status">
                <LoaderCircle className="spin" aria-hidden="true" />
                <span><span className="shimmer-text">{pending}…</span></span>
                <Button size="sm" variant="ghost" onClick={cancelPending}>Cancel</Button>
              </div>
            )}

            {proposal && (
              <section className="proposal" aria-label="Proposed change">
                <header className="proposal__head">
                  <p><Sparkles aria-hidden="true" /> <strong>{proposal.label}</strong>{proposal.kind === "script" && <span className="tabular"> · {proposal.before} → {proposal.after} words · about {formatClock(secondsFor(proposal.after))}</span>}</p>
                  <div className="proposal__actions">
                    <Button size="sm" variant="ghost" icon={<X />} onClick={() => setProposal(null)}>Discard</Button>
                    <Button size="sm" variant="primary" icon={<Check />} onClick={acceptProposal}>Accept</Button>
                  </div>
                </header>
                {proposal.kind === "script" ? (
                  <ScriptText className="proposal__script" script={{ ...active.script, document: proposal.document }} />
                ) : (
                  <div className="proposal__selection">
                    <p className="proposal__before"><span className="sr-only">Before: </span>{proposal.before}</p>
                    <p className="proposal__after"><span className="sr-only">After: </span><RevealWords text={proposal.after} /></p>
                  </div>
                )}
              </section>
            )}

            {empty && !proposal && !pending ? (
              <div className="editor-empty">
                <p>No script for this slide yet.</p>
                <div className="editor-empty__actions">
                  {aiEnabled && <Button variant="primary" size="sm" icon={<Sparkles />} onClick={() => runScriptAction("regenerate", "Write this slide", plannedWords)}>Write this slide</Button>}
                  <Button variant="secondary" size="sm" onClick={() => { setFocusEditor(true); patchScript({ origin: "user" }); }}>Write it myself</Button>
                </div>
              </div>
            ) : (
              <ScriptSurface
                key={`${active.id}:${revision}`}
                ref={surface}
                document={active.script.document}
                onChange={onDocument}
                onEdit={onEdit}
                locked={locked}
                aiEnabled={aiEnabled}
                label={`Script for slide ${index + 1}`}
                autoFocus={focusEditor}
                onSelectionRewrite={onSelectionRewrite}
                toolbarEnd={aiEnabled ? (
                  <Menu
                    label="Improve this slide"
                    align="end"
                    items={improveItems}
                    trigger={(props) => <Button {...props} size="sm" variant="secondary" icon={<Sparkles />} trailing={<ChevronDown />} disabled={locked}>Improve</Button>}
                  />
                ) : undefined}
              />
            )}




            <nav className="editor-pager" aria-label="Slide navigation">
              <Button variant="ghost" size="sm" icon={<ArrowLeft />} disabled={index === 0 || locked} onClick={() => select(slides[index - 1].id)} data-tooltip="Alt+↑" data-tooltip-side="top" aria-keyshortcuts="Alt+ArrowUp">Previous</Button>
              <Button variant="ghost" size="sm" trailing={<ArrowRight />} disabled={index === slides.length - 1 || locked} onClick={() => select(slides[index + 1].id)} data-tooltip="Alt+↓" data-tooltip-side="top" aria-keyshortcuts="Alt+ArrowDown">Next</Button>
            </nav>
          </div>
        </main>

        {inspectorOpen && (
          <Inspector project={working} slide={active} />
        )}
      </div>

      <HistorySheet project={project} open={historyOpen} onClose={() => setHistoryOpen(false)} onRestored={resync} />
    </div>
  );
}

/**
 * One slide in the rail. Memoized: typing changes only the current slide's object, so the other
 * rows skip rendering, and the highlight re-measures its layout only when it moves.
 */
const RailItem = memo(function RailItem({ slide, position, current, disabled, aspectRatio, onSelect }: {
  slide: Slide;
  position: number;
  current: boolean;
  disabled: boolean;
  aspectRatio: number;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="rail-item"
        aria-current={current ? "step" : undefined}
        data-optional={slide.optional}
        onClick={() => onSelect(slide.id)}
        disabled={disabled}
      >
        {current && <m.span layoutId="rail-current" layoutDependency={slide.id} className="rail-item__current" transition={GLIDE} aria-hidden="true" />}
        <span className="rail-item__number tabular">{position + 1}</span>
        <span className="rail-item__thumb"><SlideImage slide={slide} aspectRatio={aspectRatio} size="thumb" /></span>
        <span className="rail-item__text">
          <span className="rail-item__title">{slide.title}</span>
          {slide.optional && <span className="rail-item__meta">Optional</span>}
        </span>
      </button>
    </li>
  );
});
