"use client";

import { DeliveryFields } from "../../../components/setup/DeliveryFields";
import { ThemeToggle } from "../../../components/ui/theme-toggle";
import { clampBrief, DEFAULT_BRIEF } from "@/lib/domain/planner";
import { usePref } from "@/lib/prefs";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const [defaults, setDefaults] = usePref("defaultBrief");

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
        <DeliveryFields
          value={defaults}
          onChange={(values) => {
            const next = { ...defaults, ...values };
            const clamped = clampBrief({ ...DEFAULT_BRIEF, ...next });
            setDefaults({ ...next, minutes: clamped.minutes, wpm: clamped.wpm });
          }}
        />
      </section>
    </div>
  );
}
