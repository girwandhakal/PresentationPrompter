"use client";

import { documentToPlainText } from "./domain/script";
import { formatDuration, slugify } from "./domain/format";
import { slideSpokenSeconds } from "./domain/planner";
import type { Project } from "./domain/types";

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
