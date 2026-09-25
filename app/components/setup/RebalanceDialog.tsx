"use client";

import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AiRequestError, rewriteScript } from "@/lib/ai/client";
import { needsRepair } from "@/lib/ai/validate";
import { documentFromAi, documentToWordCount } from "@/lib/domain/script";
import { planPresentation } from "@/lib/domain/planner";
import type { Project, SlideScript } from "@/lib/domain/types";
import { useProjects } from "@/lib/store/projects";
import { Button } from "../ui/button";
import { Callout } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { useToast } from "../ui/toast";

/**
 * Fits an existing script to new timing. Shows current vs planned words per slide first; only
 * slides that are meaningfully off are rewritten, and the prior version is kept in History.
 */
export function RebalanceDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { update, saveVersion } = useProjects();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  const rows = useMemo(() => {
    const plan = planPresentation(project.brief, project.slides);
    return project.slides.map((slide, index) => {
      const target = plan.slides[index].words;
      const words = documentToWordCount(slide.script.document);
      return { slide, index, target, words, change: !slide.optional && target > 0 && words > 0 && needsRepair(words, target, project.brief.depth) };
    });
  }, [project]);
  const changing = rows.filter((row) => row.change);

  async function apply() {
    setRunning(true);
    setError(null);
    try {
      const results = new Map<string, SlideScript>();
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(3, changing.length) }, async () => {
        while (next < changing.length) {
          const row = changing[next++];
          const result = await rewriteScript(project, row.slide, "fit", row.target);
          const document = documentFromAi(result.paragraphs, result.cues.map((cue) => ({ paragraph: cue.paragraph, afterSentence: cue.afterSentence, label: cue.text })));
          results.set(row.slide.id, { ...row.slide.script, document, origin: "mixed", flags: row.slide.script.flags.filter((flag) => flag.kind !== "over-budget" && flag.kind !== "under-budget") });
          setDone((value) => value + 1);
        }
      }));
      await saveVersion(project.id, "Before rebalancing");
      await update(project.id, (current) => ({
        ...current,
        generatedWith: { minutes: current.brief.minutes, qaMinutes: current.brief.qaMinutes, wpm: current.brief.wpm, depth: current.brief.depth },
        slides: current.slides.map((slide) => results.get(slide.id) ? { ...slide, script: results.get(slide.id)! } : slide),
      }));
      toast(`Rebalanced ${changing.length === 1 ? "1 slide" : `${changing.length} slides`}. The previous version is in History.`);
      onClose();
    } catch (caught) {
      setError(caught instanceof AiRequestError ? caught.message : "Rebalancing stopped before it finished. Nothing was changed.");
      setRunning(false);
      setDone(0);
    }
  }

  async function acknowledge() {
    await update(project.id, (current) => ({ ...current, generatedWith: { minutes: current.brief.minutes, qaMinutes: current.brief.qaMinutes, wpm: current.brief.wpm, depth: current.brief.depth } }));
    onClose();
  }

  return (
    <Dialog
      open
      onClose={running ? () => {} : onClose}
      dismissible={!running}
      title="Rebalance script"
      description={changing.length
        ? `${changing.length === 1 ? "One slide is" : `${changing.length} slides are`} noticeably off the new plan and will be rewritten to fit. Other slides stay exactly as they are.`
        : "Every slide is already close to the new plan. No rewriting needed."}
      size="md"
      footer={changing.length ? <>
        <Button variant="ghost" disabled={running} onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={running} onClick={apply}>{running ? `Rewriting ${done + 1} of ${changing.length}…` : `Rebalance ${changing.length === 1 ? "1 slide" : `${changing.length} slides`}`}</Button>
      </> : <Button variant="primary" onClick={acknowledge}>Done</Button>}
    >
      {error && <Callout tone="error">{error}</Callout>}
      <table className="rebalance-table">
        <thead><tr><th scope="col">Slide</th><th scope="col" className="num">Now</th><th scope="col" aria-label="becomes" /><th scope="col" className="num">Plan</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slide.id} data-change={row.change}>
              <td><span className="faint tabular">{row.index + 1}</span> {row.slide.title}{row.slide.optional && <span className="faint"> · optional</span>}</td>
              <td className="num tabular">{row.words}</td>
              <td aria-hidden="true">{row.change && <ArrowRight />}</td>
              <td className="num tabular">{row.slide.optional ? "—" : row.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
