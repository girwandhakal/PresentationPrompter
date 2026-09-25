"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { ACCEPTED_TYPES } from "@/lib/import";
import { Button } from "../ui/button";

/** File target for decks: click, keyboard, or drag and drop. Multiple files only for slide images. */
export function DeckDropzone({ onFiles, disabled, compact, title = "Drop your deck here", hint }: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  function accept(list: FileList | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length && !disabled) onFiles(files);
  }

  return (
    <div
      className={`dropzone${compact ? " dropzone--compact" : ""}`}
      data-dragging={dragging}
      data-disabled={disabled}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        accept(event.dataTransfer.files);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (!disabled) input.current?.click();
      }}
    >
      <div className="dropzone__art" aria-hidden="true">
        <span className="dropzone__sheet dropzone__sheet--back" />
        <span className="dropzone__sheet">
          <i /><i className="is-cue" /><i />
        </span>
        <span className="dropzone__arrow"><FileUp /></span>
      </div>
      <div className="dropzone__text">
        <p className="dropzone__title">{dragging ? "Release to import" : title}</p>
        <p className="dropzone__hint">{hint ?? "PDF, PowerPoint (.pptx), or slide images · up to 100 MB"}</p>
      </div>
      <Button variant="primary" size={compact ? "sm" : "md"} disabled={disabled} onClick={() => input.current?.click()}>
        Choose file
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={ACCEPTED_TYPES}
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
