"use client";

import type { ReactNode } from "react";
import { DEFAULT_PRESENTER_PREFS, type PresenterPrefs } from "@/lib/prefs";
import { Button } from "../ui/button";
import { Kbd, Segmented, Slider, Switch } from "../ui/controls";
import { Dialog } from "../ui/dialog";

export type AudienceStatus = "none" | "connected" | "lost" | "blocked";

export function PresenterSettings({ open, prefs, onChange, onClose }: {
  open: boolean;
  prefs: PresenterPrefs;
  onChange: (prefs: PresenterPrefs) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof PresenterPrefs>(key: K, value: PresenterPrefs[K]) => onChange({ ...prefs, [key]: value });
  return (
    <Dialog open={open} onClose={onClose} variant="sheet" className="theme-dark" title="Reading settings" description="Saved in this browser for every presentation.">
      <div className="presenter-settings">
        <Group title="Text">
          <Slider label="Text size" min={24} max={96} step={2} value={prefs.fontSize} onChange={(value) => set("fontSize", value)} format={(value) => `${value}px`} />
          <Slider label="Line spacing" min={1.2} max={2.2} step={0.05} value={prefs.lineHeight} onChange={(value) => set("lineHeight", Number(value.toFixed(2)))} format={(value) => value.toFixed(2)} />
          <Slider label="Reading width" min={40} max={100} step={2} value={prefs.width} onChange={(value) => set("width", value)} format={(value) => `${value}%`} />
          <Switch checked={prefs.highContrast} onChange={(value) => set("highContrast", value)} label="High contrast" description="Pure white text for bright rooms." />
          <Switch checked={prefs.mirror} onChange={(value) => set("mirror", value)} label="Mirror text" description="For a physical teleprompter with a beam-splitter glass." />
        </Group>
        <Group title="Scrolling">
          <Slider label="Pace" min={0.6} max={1.6} step={0.05} value={prefs.paceMultiplier} onChange={(value) => set("paceMultiplier", Number(value.toFixed(2)))} format={(value) => `${Math.round(value * 100)}%`} />
          <Switch checked={prefs.autoAdvance} onChange={(value) => set("autoAdvance", value)} label="Advance at end of script" description="Moves to the next slide after a short countdown you can cancel." />
          {prefs.autoAdvance && <Slider label="Countdown" min={1} max={10} step={1} value={prefs.advanceDelay} onChange={(value) => set("advanceDelay", value)} format={(value) => `${value} s`} />}
          <Switch checked={prefs.focusLine} onChange={(value) => set("focusLine", value)} label="Reading line" description="A guide at eye level showing where to read." />
        </Group>
        <Group title="What to show">
          <div className="presenter-settings__field">
            <span className="slider__label">Reading mode</span>
            <Segmented size="sm" label="Reading mode" value={prefs.mode} onChange={(mode) => set("mode", mode)} options={[{ value: "full", label: "Script" }, { value: "notes", label: "Short" }, { value: "keywords", label: "Keywords" }, { value: "cues", label: "Cues" }]} />
          </div>
          <Switch checked={prefs.showCues} onChange={(value) => set("showCues", value)} label="Delivery cues" />
          <Switch checked={prefs.showNext} onChange={(value) => set("showNext", value)} label="Slide previews" description="Current and next slide beside the script." />
        </Group>
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_PRESENTER_PREFS)}>Reset to defaults</Button>
      </div>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="presenter-settings__group">
      <h3 className="presenter-settings__title">{title}</h3>
      {children}
    </section>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["Space", "Start or pause scrolling"],
  ["→  PageDown", "Next slide"],
  ["←  PageUp", "Previous slide"],
  ["↑  ↓", "Nudge the script"],
  ["Home / End", "Start or end of this slide"],
  ["B", "Blank the audience screen"],
  ["C", "Show or hide cues"],
  ["+ / −", "Faster or slower"],
  ["F", "Full screen"],
  ["Esc", "Close panel, cancel countdown, or end"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} size="sm" className="theme-dark" title="Keyboard shortcuts" description="Most presentation clickers send PageUp and PageDown, which work here and in the audience window.">
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys}><dt>{keys.split("  ").map((key) => <Kbd key={key}>{key}</Kbd>)}</dt><dd>{action}</dd></div>
        ))}
      </dl>
    </Dialog>
  );
}
