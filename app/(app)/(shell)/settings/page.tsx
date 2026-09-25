"use client";

import { Archive, HardDrive, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Callout, Segmented } from "../../../components/ui/controls";
import { Dialog } from "../../../components/ui/dialog";
import { Field, Input, Select } from "../../../components/ui/field";
import { useToast } from "../../../components/ui/toast";
import { useAiStatus } from "@/lib/ai/client";
import { formatBytes } from "@/lib/domain/format";
import { clampBrief, DEFAULT_BRIEF, LIMITS } from "@/lib/domain/planner";
import type { DeliveryStyle } from "@/lib/domain/types";
import { exportBackup, readBackup } from "@/lib/export";
import { DEFAULT_PRESENTER_PREFS, usePref } from "@/lib/prefs";
import { clearEverything, requestPersistence, storageEstimate } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const router = useRouter();
  const toast = useToast();
  const { projects, create } = useProjects();
  const ai = useAiStatus();
  const [theme, setTheme] = usePref("theme");
  const [defaults, setDefaults] = usePref("defaultBrief");
  const [, setPresenter] = usePref("presenter");
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageEstimate>>>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    storageEstimate().then((value) => { if (active) setStorage(value); });
    return () => { active = false; };
  }, [projects.length]);

  async function restore(file: File) {
    setBusy("restore");
    try {
      const restored = await readBackup(file, new Set(projects.map((project) => project.id)));
      for (const entry of restored) await create(entry.project, entry.blobs);
      toast(restored.length === 1 ? `Restored “${restored[0].project.title}”` : `Restored ${restored.length} presentations`);
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "That backup couldn't be restored.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function wipe() {
    setBusy("wipe");
    try {
      await clearEverything();
      setConfirmReset(false);
      toast("All presentations were deleted from this browser.");
      router.push("/");
    } catch {
      toast({ message: "Data couldn't be deleted. Try closing other Cueframe tabs first.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const setDefault = <K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) => setDefaults({ ...defaults, [key]: value });

  return (
    <div className="page page--narrow settings">
      <h1 className="page-title">Settings</h1>
      <p className="page-lede">Preferences for this browser. Your presentations are stored here too — nowhere else.</p>

      <section className="settings__section" aria-labelledby="settings-appearance">
        <h2 id="settings-appearance" className="section-title">Appearance</h2>
        <Field label="Theme" hint="Presenter mode is always dark to keep your screen calm in a dim room.">
          <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: "system", label: "Match system" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        </Field>
      </section>

      <section className="settings__section" aria-labelledby="settings-defaults">
        <h2 id="settings-defaults" className="section-title">Defaults for new presentations</h2>
        <div className="form-grid">
          <Field label="Length">
            <Input type="number" unit="min" min={LIMITS.minutes.min} max={LIMITS.minutes.max} value={defaults.minutes} onChange={(event) => setDefault("minutes", Number(event.target.value))} onBlur={() => setDefault("minutes", clampBrief({ ...DEFAULT_BRIEF, ...defaults }).minutes)} />
          </Field>
          <Field label="Speaking pace">
            <Input type="number" unit="wpm" min={LIMITS.wpm.min} max={LIMITS.wpm.max} value={defaults.wpm} onChange={(event) => setDefault("wpm", Number(event.target.value))} onBlur={() => setDefault("wpm", clampBrief({ ...DEFAULT_BRIEF, ...defaults }).wpm)} />
          </Field>
          <Field label="Delivery style">
            <Select value={defaults.style} onChange={(event) => setDefault("style", event.target.value as DeliveryStyle)}>
              {["conversational", "measured", "concise", "energetic", "technical", "executive"].map((style) => <option key={style} value={style}>{style[0].toUpperCase() + style.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Script depth">
            <Select value={defaults.depth} onChange={(event) => setDefault("depth", event.target.value as typeof defaults.depth)}>
              <option value="full">Full script</option>
              <option value="notes">Concise notes</option>
              <option value="cues">Keywords</option>
            </Select>
          </Field>
        </div>
        <div className="settings__row">
          <Button variant="ghost" size="sm" onClick={() => setPresenter(DEFAULT_PRESENTER_PREFS)}>Reset presenter reading settings</Button>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-ai">
        <h2 id="settings-ai" className="section-title">AI writing</h2>
        {!ai ? (
          <p className="muted">Checking…</p>
        ) : ai.provider === "openai" ? (
          <Callout title="Connected">Scripts are written by OpenAI{ai.model ? ` (${ai.model})` : ""}. When you ask for a script or a rewrite, slide images, slide text, and your brief are sent to it. Nothing is sent otherwise.</Callout>
        ) : ai.provider === "demo" ? (
          <Callout tone="warn" title="Demo mode">Scripts are assembled from your slide text so you can try the whole flow. They aren&apos;t written by an AI model. Set <code>OPENAI_API_KEY</code> on the server for real writing.</Callout>
        ) : (
          <Callout tone="warn" title="Not set up">This server has no AI key, so scripts can&apos;t be generated. You can still import slides, write your own script, and present. Set <code>OPENAI_API_KEY</code> on the server to enable it.</Callout>
        )}
      </section>

      <section className="settings__section" aria-labelledby="settings-data">
        <h2 id="settings-data" className="section-title">Your data</h2>
        <div className="storage-card">
          <HardDrive aria-hidden="true" />
          <div>
            <p className="storage-card__title">{projects.length} presentation{projects.length === 1 ? "" : "s"}{storage ? ` · ${formatBytes(storage.usage)} used` : ""}</p>
            <p className="storage-card__text">
              {storage?.persisted
                ? "This browser will keep your presentations even when storage runs low."
                : "Browsers can clear site data when storage runs low. Keep backups of work you care about, or ask the browser to keep it."}
            </p>
          </div>
          {storage && !storage.persisted && (
            <Button size="sm" variant="secondary" onClick={async () => {
              const granted = await requestPersistence();
              setStorage(await storageEstimate());
              toast(granted ? "This browser will keep your presentations." : "The browser didn't allow it. Regular backups are the safest option.");
            }}>Keep my data</Button>
          )}
        </div>
        <div className="settings__row">
          <Button variant="secondary" icon={<Archive />} disabled={!projects.length} loading={busy === "backup"} onClick={async () => {
            setBusy("backup");
            try { await exportBackup(projects); } catch { toast({ message: "The backup couldn't be created.", tone: "error" }); } finally { setBusy(null); }
          }}>Download backup of everything</Button>
          <Button variant="secondary" icon={<Upload />} loading={busy === "restore"} onClick={() => restoreInput.current?.click()}>Restore from backup</Button>
          <input ref={restoreInput} type="file" accept=".cueframe,application/zip" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.target.value = ""; }} />
        </div>
        <div className="settings__danger">
          <div>
            <p className="settings__danger-title">Delete everything</p>
            <p className="settings__danger-text">Removes every presentation, script, version, and session from this browser.</p>
          </div>
          <Button variant="secondary" icon={<Trash2 />} disabled={!projects.length} onClick={() => { setConfirmText(""); setConfirmReset(true); }}>Delete all…</Button>
        </div>
      </section>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Delete all presentations?"
        description={`This permanently removes ${projects.length} presentation${projects.length === 1 ? "" : "s"} from this browser. It can't be undone.`}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button variant="primary" disabled={confirmText.trim().toLowerCase() !== "delete"} loading={busy === "wipe"} onClick={wipe}>Delete everything</Button>
        </>}
      >
        <Field label='Type "delete" to confirm'>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </div>
  );
}
