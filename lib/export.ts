"use client";

import { shortId } from "./domain/factory";
import { documentToPlainText } from "./domain/script";
import { formatDuration, slugify } from "./domain/format";
import { slideSpokenSeconds } from "./domain/planner";
import type { Project } from "./domain/types";
import { getBlob } from "./store/db";

export function downloadFile(name: string, content: Blob | string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function scriptToMarkdown(project: Project) {
  const lines = [`# ${project.title}`, ""];
  if (project.brief.goal) lines.push(`**Goal:** ${project.brief.goal}  `);
  if (project.brief.audience) lines.push(`**Audience:** ${project.brief.audience}  `);
  lines.push(`**Target:** ${project.brief.minutes} min at ${project.brief.wpm} wpm`, "");
  project.slides.forEach((slide, index) => {
    lines.push(`## ${index + 1}. ${slide.title || `Slide ${index + 1}`}${slide.optional ? " (optional)" : ""}`, "");
    if (slide.script.purpose) lines.push(`_${slide.script.purpose}_`, "");
    const body = documentToPlainText(slide.script.document);
    lines.push(body ? body.replace(/\[([^\]]+)\]/g, "> **Cue:** $1") : "_No script yet._", "");
    if (slide.script.transition) lines.push(`**Transition:** ${slide.script.transition}`, "");
    if (slide.script.questions.length) {
      lines.push("**Likely questions**", "");
      for (const question of slide.script.questions) lines.push(`- **${question.question}** ${question.answer}`);
      lines.push("");
    }
    lines.push(`<sub>About ${formatDuration(slideSpokenSeconds(slide, project.brief.wpm))}</sub>`, "");
  });
  return lines.join("\n");
}

export function scriptToText(project: Project) {
  return [
    project.title.toUpperCase(),
    "",
    ...project.slides.flatMap((slide, index) => [
      `${index + 1}. ${slide.title || `Slide ${index + 1}`}`,
      "",
      documentToPlainText(slide.script.document) || "(No script yet.)",
      "",
    ]),
  ].join("\n");
}

export function exportMarkdown(project: Project) {
  downloadFile(`${slugify(project.title)}-script.md`, scriptToMarkdown(project), "text/markdown;charset=utf-8");
}

export function exportText(project: Project) {
  downloadFile(`${slugify(project.title)}-script.txt`, scriptToText(project));
}

// ── Backups (.cueframe) ─────────────────────────────────────────────────────

const BACKUP_FORMAT = "cueframe-backup";
const BACKUP_VERSION = 1;

export async function exportBackup(projects: Project[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), projects: projects.map((project) => project.id) }));
  for (const project of projects) {
    zip.file(`projects/${project.id}/project.json`, JSON.stringify(project));
    for (const slide of project.slides) {
      for (const key of [slide.imageKey, slide.thumbKey]) {
        const blob = await getBlob(key);
        if (blob) zip.file(`projects/${project.id}/blobs/${encodeURIComponent(key)}`, blob);
      }
    }
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const name = projects.length === 1 ? `${slugify(projects[0].title)}.cueframe` : `cueframe-backup-${new Date().toISOString().slice(0, 10)}.cueframe`;
  downloadFile(name, blob);
}

export async function readBackup(file: File, existingIds: Set<string>) {
  const { default: JSZip } = await import("jszip");
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("This file isn't a Cueframe backup.");
  }
  const manifestFile = zip.file("manifest.json");
  const manifest = manifestFile ? JSON.parse(await manifestFile.async("string")) : null;
  if (manifest?.format !== BACKUP_FORMAT) throw new Error("This file isn't a Cueframe backup.");
  if (manifest.version > BACKUP_VERSION) throw new Error("This backup was made by a newer version of Cueframe.");

  const results: { project: Project; blobs: [string, Blob][] }[] = [];
  for (const id of manifest.projects as string[]) {
    const projectFile = zip.file(`projects/${id}/project.json`);
    if (!projectFile) continue;
    const project = JSON.parse(await projectFile.async("string")) as Project;
    const newId = existingIds.has(project.id) ? shortId() : project.id;
    const blobs: [string, Blob][] = [];
    for (const slide of project.slides) {
      for (const field of ["imageKey", "thumbKey"] as const) {
        const entry = zip.file(`projects/${id}/blobs/${encodeURIComponent(slide[field])}`);
        if (!entry) {
          slide[field] = "";
          continue;
        }
        const data = await entry.async("blob");
        const key = `${newId}/${slide.id}/${field === "imageKey" ? "image" : "thumb"}`;
        blobs.push([key, data.type ? data : new Blob([data], { type: guessImageType(slide[field]) })]);
        slide[field] = key;
      }
    }
    results.push({ project: { ...project, id: newId, generation: { status: "idle" }, analysis: project.analysis.status === "running" ? { status: "idle" } : project.analysis }, blobs });
  }
  if (!results.length) throw new Error("This backup doesn't contain any presentations.");
  return results;
}

function guessImageType(key: string) {
  return key.endsWith("thumb") ? "image/jpeg" : "image/webp";
}
