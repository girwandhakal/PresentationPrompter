import type { ScriptDocument, ScriptInline, ScriptText } from "./script-types";
import { parseScriptDocument } from "./script-types";

function renderText(child: ScriptText) {
  if (child.bold && child.italic) return <strong><em>{child.text}</em></strong>;
  if (child.bold) return <strong>{child.text}</strong>;
  if (child.italic) return <em>{child.text}</em>;
  return child.text;
}

function renderInline(child: ScriptInline, index: number, paragraphId: string, showCueIcon: boolean) {
  if (child.type === "break") return <br key={`${paragraphId}-break-${index}`} />;
  if (child.type === "cue") {
    return <span key={child.id} className="teleprompter-cue" data-cue-id={child.id} aria-label={`Cue: ${child.label}`}>{showCueIcon ? "✦ " : ""}{child.label}</span>;
  }
  return <span key={`${paragraphId}-text-${index}`}>{renderText(child)}</span>;
}

export function TeleprompterText({ value = "", script, className, showCueIcon = true }: { value?: string; script?: ScriptDocument; className?: string; showCueIcon?: boolean }) {
  const document = script ?? parseScriptDocument(undefined, value);
  return (
    <div className={className}>
      {document.paragraphs.map((paragraph) => {
        const cueOnly = paragraph.children.length > 0 && paragraph.children.every((child) => child.type === "cue");
        return (
          <div key={paragraph.id} className={`teleprompter-text__line${cueOnly ? " teleprompter-text__line--cue" : ""}`}>
            {paragraph.children.map((child, index) => renderInline(child, index, paragraph.id, showCueIcon))}
          </div>
        );
      })}
    </div>
  );
}
