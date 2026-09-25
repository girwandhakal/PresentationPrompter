"use client";

import { Field, Input, Select } from "../../../components/ui/field";
import { ThemeToggle } from "../../../components/ui/theme-toggle";
import { clampBrief, DEFAULT_BRIEF, LIMITS } from "@/lib/domain/planner";
import type { DeliveryStyle } from "@/lib/domain/types";
import { usePref } from "@/lib/prefs";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const [defaults, setDefaults] = usePref("defaultBrief");

  const setDefault = <K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) => setDefaults({ ...defaults, [key]: value });

  return (
    <div className="page page--narrow settings">
      <h1 className="page-title">Settings</h1>

      <section className="settings__section" aria-labelledby="settings-appearance">
        <div className="settings__theme">
          <h2 id="settings-appearance" className="section-title">Theme</h2>
          <ThemeToggle />
        </div>
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
      </section>
    </div>
  );
}
