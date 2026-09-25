"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { documentToWordCount } from "@/lib/domain/script";
import type { Project, ScriptVersion } from "@/lib/domain/types";
import { listVersions } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { Button } from "../ui/button";
import { EmptyState, Spinner } from "../ui/controls";
import { Dialog } from "../ui/dialog";
import { useToast } from "../ui/toast";

function when(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Saved script versions: taken when a script is written, and before slides are removed or replaced or a version is restored. */
export function HistorySheet({ project, open, onClose, onRestored }: { project: Project; open: boolean; onClose: () => void; onRestored: () => void }) {
  const { restoreVersion } = useProjects();
  const toast = useToast();
  const [versions, setVersions] = useState<ScriptVersion[] | null>(null);
  const [confirm, setConfirm] = useState<ScriptVersion | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listVersions(project.id).then((items) => { if (active) setVersions(items); }).catch(() => { if (active) setVersions([]); });
    return () => { active = false; setVersions(null); };
  }, [open, project.id]);

  async function restore(version: ScriptVersion) {
    await restoreVersion(project.id, version);
    setConfirm(null);
    onClose();
    onRestored();
    toast({ message: `Restored “${version.label}”. Your previous script was saved to History.` });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} variant="sheet" title="History" description="Earlier versions of this script. Restoring one saves the current script first, so nothing is lost.">
        {!versions ? (
          <div className="center-state"><Spinner label="Loading history" /></div>
        ) : !versions.length ? (
          <EmptyState icon={<History />} title="No saved versions yet">Versions are saved when a script is written, and before slides are removed or replaced.</EmptyState>
        ) : (
          <ol className="history-list">
            {versions.map((version) => {
              const words = version.slides.reduce((sum, entry) => sum + documentToWordCount(entry.script.document), 0);
              return (
                <li key={version.id} className="history-item">
                  <div>
                    <p className="history-item__label">{version.label}</p>
                    <p className="history-item__meta tabular">{when(version.createdAt)} · {words.toLocaleString()} words</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(version)}>Restore</Button>
                </li>
              );
            })}
          </ol>
        )}
      </Dialog>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title="Restore this version?"
        description={confirm ? `The script for every slide will be replaced with “${confirm.label}” from ${when(confirm.createdAt)}. The current script is saved to History first.` : undefined}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="primary" onClick={() => confirm && restore(confirm)}>Restore</Button>
        </>}
      />
    </>
  );
}
