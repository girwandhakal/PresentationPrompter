import { unsupportedQuantities } from "./quantities";
import type { BriefInput, QualityIssue, WriteSlideInput } from "../schemas";

/**
 * Cheap, deterministic checks for script text that reads like slide notes instead of speech, uses
 * sales-deck language, or states figures the source material doesn't contain. They never call a
 * model and never block a draft: the results are private notes for the presenter.
 */

// One to three words then a colon, at the start of a sentence: "Keep:", "Short version:", "Iteration 1 goal:".
// A signpost ahead of the label doesn't make it speech: "Second, external dependencies: …".
const LABEL_OPENER = /(^|[.!?]\s+)(?:(?:First|Second|Third|Next|Then|Finally|Also|Lastly),\s+)?[A-Za-z][A-Za-z0-9’']*(?: [A-Za-z0-9’']+){0,2}:\s+\S/;
// A real spoken sentence with a colon ("Here's the thing: …", "We did it: …") contains one of these.
const SPOKEN_WORDS = /\b(?:the|we|i|it|is|was|are|were|here's|that's|so|and|to)\b/i;
const ID_REFERENCE = /(?:#|PR\s?#?)\d+/gi;
// Sales-deck filler the voice rules forbid; one hit is enough to ask for a rewrite.
const HYPE = /\b(?:game[- ]?changer|game[- ]changing|revolutionary|revolutioni[sz]e|cutting[- ]edge|groundbreaking|world[- ]class|best[- ]in[- ]class|next[- ]level|synergy|synergies|delve|unlock the (?:full )?(?:power|potential)|in today's fast[- ]paced|supercharge|thrilled to)\b/i;
export function ungroundedFigures(paragraphs: string[], source: string) {
  return [...new Set(unsupportedQuantities(paragraphs.join(" "), source).map((item) => item.text))];
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

/**
 * Returns human-readable problems; an empty array means the text sounds spoken enough. With
 * `source` (everything the script may draw on), figures that don't trace back to it are problems too.
 */
export function spokenProblems(paragraphs: string[], source?: string, depth: BriefInput["depth"] = "full"): string[] {
  const text = paragraphs.join(" ").trim();
  if (!text) return [];
  const problems: string[] = [];

  const label = paragraphs
    .map((paragraph) => LABEL_OPENER.exec(paragraph)?.[0].trim())
    .find((match) => match && !SPOKEN_WORDS.test(match.replace(/^[.!?]\s*/, "")));
  if (depth === "full" && label) problems.push(`It uses a slide-style label with a colon ("${label.replace(/^[.!?]\s*/, "")}…"). Speech doesn't announce labels; fold the idea into a sentence.`);

  const all = sentences(text);
  if (depth === "full" && all.length >= 3) {
    const average = words(text) / all.length;
    const complete = /\b(?:is|are|was|were|will|can|could|do|does|did|has|have|had|upload|validate|save|compare|check|calculate|review|keep|show|record|measure|share|deploy|turn|rose|fell|passed|failed|remains|changed|needs|works|stopped)\b|let[’\']s/i;
    const fragments = all.filter((sentence) => !complete.test(sentence)).length;
    if (average < 7 && fragments >= Math.ceil(all.length / 2)) problems.push(`Its sentences average ${average.toFixed(1)} words, which reads as clipped notes. Use complete sentences; short procedural steps are fine when their meaning is clear.`);
  }

  if (depth === "full") {
    const dense = all.find((sentence) => words(sentence) > 32);
    if (dense) problems.push(`Review this long sentence for stacked clauses: "${dense}"`);
  }

  const ids = text.match(ID_REFERENCE)?.length ?? 0;
  if (ids >= 3) problems.push(`It recites ${ids} ticket or PR numbers. Name at most one or two and summarize the rest in words.`);

  const hype = HYPE.exec(text)?.[0];
  if (hype) problems.push(`It uses sales-deck language ("${hype}"). Say it plainly, the way you'd explain it to a colleague.`);

  const invented = source == null ? [] : ungroundedFigures(paragraphs, source);
  if (invented.length) problems.push(`It states ${invented.map((figure) => `"${figure}"`).join(", ")}, which isn't in the slide, notes, or brief. Use only figures from the material, or describe the point without a number.`);

  return problems;
}

type SourceSlide = Pick<WriteSlideInput, "title" | "text" | "notes" | "analysis">;

/**
 * Everything a script may draw its figures from: the slide, its notes, the presenter's required
 * facts, and what the analysis saw. Timing, plans, and voice samples are never evidence.
 */
export function slideSource(slide: SourceSlide, brief: BriefInput) {
  return [slide.title, slide.text, slide.notes, brief.mustInclude, slide.analysis?.visualSummary ?? ""].filter(Boolean).join("\n");
}

/**
 * Private notes on one written slide: figures its sources don't contain (neighboring slides in the
 * same batch count, so recaps can quote them), unreadable source material, and a draft far shorter
 * than its time allocation.
 */
export function draftNotes(slide: WriteSlideInput & { script: { paragraphs: string[]; concise: string; recovery: string; transition: string } }, evidence: string, brief: BriefInput): QualityIssue[] {
  const { script } = slide;
  const issues: QualityIssue[] = ungroundedFigures([...script.paragraphs, script.concise, script.recovery, script.transition], evidence)
    .map((figure) => ({ severity: "warning", category: "fidelity", quote: "", message: `The quantity ${figure} wasn't found in the slide or notes. Check it against the slide.`, sourceIds: [] }));
  if (!slide.text.trim() && !slide.notes.trim() && (!slide.analysis || slide.analysis.uncertain.length)) issues.push({ severity: "warning", category: "source", quote: "", message: "Some slide content could not be read confidently. Check the explanation against the slide and add speaker notes for any missing detail.", sourceIds: [] });
  const words = script.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  if (brief.depth === "full" && slide.targetWords >= 80 && words < slide.targetWords * 0.65) issues.push({ severity: "warning", category: "timing", quote: "", message: "This draft is shorter than its time allocation. Rehearse it and shorten the timing or add supporting speaker notes if more explanation is needed.", sourceIds: [] });
  return issues;
}
