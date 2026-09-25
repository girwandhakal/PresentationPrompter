"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DeckDropzone } from "../../../../../components/import/DeckDropzone";
import { ImportProgressCard } from "../../../../../components/import/ImportProgressCard";
import { useImporter } from "../../../../../components/import/use-importer";
import { ProjectRoute } from "../../../../../components/project/ProjectRoute";
import { SlideImage } from "../../../../../components/project/SlideImage";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { Callout } from "../../../../../components/ui/controls";
import { Select } from "../../../../../components/ui/field";
import { useToast } from "../../../../../components/ui/toast";
import { documentToWordCount } from "@/lib/domain/script";
import { matchSlides } from "@/lib/domain/match";
import { emptyScript, hasScript } from "@/lib/domain/planner";
import { pluralize } from "@/lib/domain/format";
import type { Project, Slide } from "@/lib/domain/types";
import type { ImportResult } from "@/lib/import";
import { releaseBlobUrls } from "@/lib/store/blob-url";
import { deleteBlobs, putBlobs } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { useDocumentTitle } from "@/lib/use-document-title";

/**
 * Replace a deck with a new export (e.g. a PDF of an updated PowerPoint) while keeping the script.
 * Matches are proposed from slide content and confirmed by the presenter before anything changes.
 */
function Replace({ project }: { project: Project }) {
  useDocumentTitle(`Replace slides · ${project.title}`);
  const router = useRouter();
  const toast = useToast();
  const { update, saveVersion } = useProjects();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  const onImported = useCallback((imported: ImportResult) => {
    const matches = matchSlides(project.slides, imported.slides.map((slide) => ({ id: slide.id!, title: slide.title, text: slide.text })));
    setMapping(Object.fromEntries(matches.map((match) => [match.newId, match.oldId ?? ""])));
    setResult(imported);
  }, [project.slides]);

  const { state, start, cancel, reset } = useImporter({ onImported });
  const oldById = useMemo(() => new Map(project.slides.map((slide, index) => [slide.id, { slide, index }])), [project.slides]);

  async function apply() {
    if (!result) return;
    setApplying(true);
    try {
      await saveVersion(project.id, "Before replacing slides");
      const slides: Slide[] = result.slides.map((imported) => {
        const previous = mapping[imported.id!] ? oldById.get(mapping[imported.id!])?.slide : undefined;
        return {
          ...imported,
          id: imported.id!,
          optional: previous?.optional ?? false,
          targetSeconds: previous?.targetSeconds ?? null,
          analysis: null,
          script: previous ? structuredClone(previous.script) : emptyScript(),
          notes: imported.notes || previous?.notes || "",
        };
      });
      await putBlobs(result.blobs);
      const oldKeys = project.slides.flatMap((slide) => [slide.imageKey, slide.thumbKey]);
      await update(project.id, (current) => ({
        ...current,
        slides,
        aspectRatio: result.aspectRatio,
        source: { fileName: result.fileName, kind: result.kind, bytes: result.bytes },
        analysis: { status: "idle" },
        status: hasScript({ slides }) ? "ready" : "setup",
      }));
      void deleteBlobs(oldKeys);
      releaseBlobUrls(oldKeys);
      toast("Slides replaced. The previous script is saved in History.");
      router.push(`/p/${project.id}`);
    } catch {
      toast({ message: "The slides couldn't be replaced. Nothing was changed.", tone: "error" });
      setApplying(false);
    }
  }

  const carried = result ? result.slides.filter((slide) => mapping[slide.id!]).length : 0;
  const leftover = result ? project.slides.filter((slide) => !Object.values(mapping).includes(slide.id) && documentToWordCount(slide.script.document) > 0) : [];

  return (
    <div className="page replace">
      <ButtonLink href={`/p/${project.id}`} variant="quiet" icon={<ArrowLeft />}>{project.title}</ButtonLink>
      <h1 className="page-title">Replace slides</h1>
      <p className="page-lede">Upload an updated version of this deck. You&apos;ll confirm which script goes with each new slide before anything changes.</p>

      {!result && (
        state.status === "working" ? <ImportProgressCard state={state} onCancel={cancel} /> : (
          <div className="new-presentation">
            {state.status === "error" && <Callout tone="error" title="That file couldn't be imported" action={<Button size="sm" variant="ghost" onClick={reset}>Dismiss</Button>}>{state.message}</Callout>}
            <DeckDropzone onFiles={start} title="Drop the updated deck here" />
          </div>
        )
      )}

      {result && (
        <section className="replace__review" aria-label="Match scripts to new slides">
          <div className="replace__summary">
            <p><strong>{pluralize(result.slides.length, "new slide")}</strong> · scripts carried over for {carried}</p>
            <div className="replace__actions">
              <Button variant="ghost" onClick={() => { setResult(null); reset(); }}>Choose a different file</Button>
              <Button variant="primary" loading={applying} onClick={apply}>Replace slides</Button>
            </div>
          </div>
          {leftover.length > 0 && (
            <Callout tone="warn" title={`${pluralize(leftover.length, "script")} won't be used`}>
              {leftover.map((slide) => `“${slide.title}”`).join(", ")}. They stay available in History.
            </Callout>
          )}
          <ol className="replace__list">
            {result.slides.map((slide, index) => {
              const previous = mapping[slide.id!] ? oldById.get(mapping[slide.id!]) : undefined;
              return (
                <li key={slide.id} className="replace__row">
                  <span className="replace__number tabular">{index + 1}</span>
                  <PreviewThumb blobs={result.blobs} slide={slide} aspectRatio={result.aspectRatio} />
                  <div className="replace__text">
                    <p className="replace__title">{slide.title}</p>
                    <label className="replace__select">
                      <span className="sr-only">Script for new slide {index + 1}</span>
                      <Select value={mapping[slide.id!] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [slide.id!]: event.target.value }))}>
                        <option value="">No script (start fresh)</option>
                        {project.slides.map((old, oldIndex) => <option key={old.id} value={old.id}>Script from slide {oldIndex + 1}: {old.title}</option>)}
                      </Select>
                    </label>
                    {previous && <p className="replace__hint">{documentToWordCount(previous.slide.script.document)} words carried over</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Thumbnails of not-yet-saved slides come straight from the imported blobs. */
function PreviewThumb({ blobs, slide, aspectRatio }: { blobs: [string, Blob][]; slide: ImportResult["slides"][number]; aspectRatio: number }) {
  const [url] = useState(() => {
    const blob = blobs.find(([key]) => key === slide.thumbKey)?.[1];
    return blob ? URL.createObjectURL(blob) : null;
  });
  if (!url) return <SlideImage slide={slide} aspectRatio={aspectRatio} size="thumb" className="replace__thumb" />;
  return (
    <div className="slide-image slide-image--thumb replace__thumb" style={{ aspectRatio: String(aspectRatio) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img src={url} alt="" />
    </div>
  );
}

export default function ReplacePage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectRoute params={params}>{(project) => <Replace key={project.id} project={project} />}</ProjectRoute>;
}
