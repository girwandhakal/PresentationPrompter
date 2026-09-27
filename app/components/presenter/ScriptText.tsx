import { Fragment } from "react";
import { splitSentences, type ScriptInline, type ScriptText as ScriptTextRun } from "@/lib/domain/script";
import type { SlideScript } from "@/lib/domain/types";
import type { PresenterPrefs } from "@/lib/prefs";

export type ReadingMode = PresenterPrefs["mode"];

function run(child: ScriptTextRun, key: string) {
  let node: React.ReactNode = child.text;
  if (child.italic) node = <em>{node}</em>;
  if (child.bold) node = <strong>{node}</strong>;
  if (child.slow) node = <span className="st-slow">{node}</span>;
  return <Fragment key={key}>{node}</Fragment>;
}

function Cue({ label }: { label: string }) {
  return (
    <p className="st-cue" data-cue="true">
      <span className="st-cue__mark" aria-hidden="true" />
      <span className="sr-only">Cue: </span>
      {label}
    </p>
  );
}

/**
 * Teleprompter rendering of a slide's private script. Shared by the editor preview and Presenter
 * so wrapping, cue marks, and reading modes look identical in both places.
 */
export function ScriptText({ script, mode = "full", showCues = true, className }: {
  script: SlideScript;
  mode?: ReadingMode;
  showCues?: boolean;
  className?: string;
}) {
  const classes = ["script-text", `script-text--${mode}`, className].filter(Boolean).join(" ");

  if (mode === "notes" && script.concise.trim()) {
    return (
      <div className={classes}>
        {splitSentences(script.concise).map((sentence, index) => <p key={index} className="st-line">{sentence}</p>)}
      </div>
    );
  }

  if (mode === "keywords" && script.keywords.length) {
    return (
      <div className={classes}>
        <ul className="st-keywords">{script.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}</ul>
      </div>
    );
  }

  if (mode === "cues") {
    const cues = script.document.paragraphs.flatMap((paragraph) => paragraph.children.filter((child): child is Extract<ScriptInline, { type: "cue" }> => child.type === "cue"));
    return (
      <div className={classes}>
        {cues.length ? cues.map((cue) => <Cue key={cue.id} label={cue.label} />) : <p className="st-empty">No cues on this slide.</p>}
      </div>
    );
  }

  const paragraphs = script.document.paragraphs.filter((paragraph) => paragraph.children.some((child) => child.type !== "text" || child.text.trim()));
  if (!paragraphs.length) return <div className={classes}><p className="st-empty">No script for this slide yet.</p></div>;

  return (
    <div className={classes}>
      {paragraphs.map((paragraph) => {
        const cueOnly = paragraph.children.every((child) => child.type === "cue");
        if (cueOnly) {
          if (!showCues) return null;
          return paragraph.children.map((child) => child.type === "cue" ? <Cue key={child.id} label={child.label} /> : null);
        }
        return (
          <p key={paragraph.id} className="st-line">
            {paragraph.children.map((child, index) => {
              if (child.type === "break") return <br key={index} />;
              if (child.type === "cue") return showCues ? <span key={child.id} className="st-inline-cue">{child.label}</span> : null;
              return run(child, `${paragraph.id}-${index}`);
            })}
          </p>
        );
      })}
    </div>
  );
}
