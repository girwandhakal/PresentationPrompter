"use client";

import { Check, MonitorUp } from "lucide-react";
import type { ReactNode } from "react";
import { pluralize } from "@/lib/domain/format";
import type { Project } from "@/lib/domain/types";
import { DEFAULT_PRESENTER_PREFS, type PresenterPrefs } from "@/lib/prefs";
import { Button } from "../ui/button";
import { Callout, Kbd, Segmented, Slider, Switch } from "../ui/controls";
import { Dialog } from "../ui/dialog";

export type AudienceStatus = "none" | "connected" | "lost" | "blocked";

export function Preflight({ open, project, audience, onOpenAudience, onStart, onClose, calmStart, onCalmStart }: {
  open: boolean;
  project: Project;
  audience: AudienceStatus;
  onOpenAudience: () => void;
  onStart: () => void;
  onClose: () => void;
  calmStart: boolean;
  onCalmStart: (value: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      className="theme-dark"
      title="Ready to present?"
      description="A quick check so your audience sees only your slides."
      footer={audience === "connected"
        ? <Button variant="accent" onClick={onStart}>Start presenting</Button>
        : <Button variant="secondary" onClick={onStart}>Start without audience window</Button>}
    >
      <ol className="preflight">
        <li data-done={audience === "connected"}>
          <span className="preflight__step" aria-hidden="true">{audience === "connected" ? <Check /> : "1"}</span>
          <div>
            <p className="preflight__title">Open the audience window</p>
            <p className="preflight__text">It shows only your slides. Move it to the projector or second display, then press <Kbd>F</Kbd> in it for full screen.</p>
            <div className="preflight__action">
              {audience === "connected"
                ? <span className="preflight__ok">Audience window connected</span>
                : <Button size="sm" variant="primary" icon={<MonitorUp />} onClick={onOpenAudience}>Open audience window</Button>}
            </div>
            {audience === "blocked" && (
              <Callout tone="warn" title="Your browser blocked the window">Allow pop-ups for this site, then choose Open audience window again.</Callout>
            )}
          </div>
        </li>
        <li>
          <span className="preflight__step" aria-hidden="true">2</span>
          <div>
            <p className="preflight__title">Share only that window</p>
            <p className="preflight__text">In Zoom, Teams, or Meet, choose to share a <strong>window</strong> and pick <strong>“Audience · {project.title}”</strong>. Don&apos;t share your whole screen or this tab — this tab is private.</p>
          </div>
        </li>
        <li>
          <span className="preflight__step" aria-hidden="true">3</span>
          <div>
            <p className="preflight__title">Check the plan</p>
            <p className="preflight__text tabular">{pluralize(project.slides.length, "slide")} · {project.brief.minutes} min{project.brief.qaMinutes ? ` incl. ${project.brief.qaMinutes} min Q&A` : ""} · {project.brief.wpm} words per minute</p>
          </div>
        </li>
      </ol>
      <div className="preflight__options">
        <Switch checked={calmStart} onChange={onCalmStart} label="Calm start" description="A short pause and a breath before the timer starts." />
      </div>
    </Dialog>
  );
}

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
          {prefs.autoAdvance && <Slider label="Countdown" min={2} max={10} step={1} value={prefs.advanceDelay} onChange={(value) => set("advanceDelay", value)} format={(value) => `${value} s`} />}
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
