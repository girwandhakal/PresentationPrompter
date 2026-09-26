"use client";

import { Briefcase, Cpu, Hourglass, MessageCircle, Scissors, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { LIMITS } from "@/lib/domain/planner";
import type { Brief, DeliveryStyle, ScriptDepth } from "@/lib/domain/types";
import { Segmented, Slider } from "../ui/controls";
import { ChoiceCards, LengthPicker, PaceVisual, ShapeVisual } from "./BriefControls";

const STYLES: { value: DeliveryStyle; label: string; icon: ReactNode }[] = [
  { value: "conversational", label: "Conversational", icon: <MessageCircle /> },
  { value: "measured", label: "Measured", icon: <Hourglass /> },
  { value: "concise", label: "Concise", icon: <Scissors /> },
  { value: "energetic", label: "Energetic", icon: <Zap /> },
  { value: "technical", label: "Technical", icon: <Cpu /> },
  { value: "executive", label: "Executive", icon: <Briefcase /> },
];

const PACES = [
  { value: 115, label: "Relaxed" },
  { value: 130, label: "Natural" },
  { value: 150, label: "Brisk" },
];

const DEPTHS: { value: ScriptDepth; label: string }[] = [
  { value: "full", label: "Full script" },
  { value: "notes", label: "Concise notes" },
  { value: "cues", label: "Keywords" },
];

const CUE_COUNT: Record<Brief["cueDensity"], number> = { none: 0, light: 1, detailed: 3 };

export type DeliveryValues = Pick<Brief, "minutes" | "wpm" | "style" | "depth" | "cueDensity">;

/**
 * Length, pace, voice, and script detail as visual controls. Shared by a presentation's setup and the
 * defaults in Settings, so both read and behave the same.
 */
export function DeliveryFields({ value, onChange, perSlide = null }: {
  value: DeliveryValues;
  onChange: (patch: Partial<DeliveryValues>) => void;
  perSlide?: string | null;
}) {
  return (
    <div className="delivery">
      <div className="delivery-grid">
        <div className="delivery-block">
          <h3 className="delivery-block__title">Length</h3>
          <LengthPicker minutes={value.minutes} min={LIMITS.minutes.min} max={LIMITS.minutes.max} onChange={(minutes) => onChange({ minutes })} perSlide={perSlide} />
        </div>
        <div className="delivery-block">
          <h3 className="delivery-block__title">Speaking pace</h3>
          <ChoiceCards
            label="Speaking pace"
            columns={1}
            className="choice-cards--rows"
            value={PACES.some((pace) => pace.value === value.wpm) ? String(value.wpm) : null}
            onChange={(wpm) => onChange({ wpm: Number(wpm) })}
            options={PACES.map((pace) => ({ value: String(pace.value), title: pace.label, meta: <span className="tabular">{pace.value} wpm</span>, visual: <PaceVisual wpm={pace.value} /> }))}
          />
          <Slider label="Words per minute" min={LIMITS.wpm.min} max={LIMITS.wpm.max} step={5} value={value.wpm} onChange={(wpm) => onChange({ wpm })} format={(wpm) => `${wpm} wpm`} />
        </div>
        <div className="delivery-block delivery-block--full">
          <h3 className="delivery-block__title">Voice</h3>
          <ChoiceCards
            label="Delivery style"
            value={value.style}
            onChange={(style) => onChange({ style })}
            options={STYLES.map((style) => ({ value: style.value, title: style.label, icon: style.icon }))}
          />
        </div>
        <div className="delivery-block delivery-block--full">
          <h3 className="delivery-block__title">Script detail</h3>
          <ChoiceCards
            label="Script depth"
            className="choice-cards--shape"
            value={value.depth}
            onChange={(depth) => onChange({ depth })}
            options={DEPTHS.map((depth) => ({ value: depth.value, title: depth.label, visual: <ShapeVisual depth={depth.value} cues={CUE_COUNT[value.cueDensity]} /> }))}
          />
          <div className="cue-row">
            <div>
              <p className="cue-row__label">Delivery cues</p>
              <p className="cue-row__hint">Private reminders like &ldquo;pause&rdquo; or &ldquo;point to chart&rdquo;.</p>
            </div>
            <Segmented label="Delivery cues" size="sm" value={value.cueDensity} onChange={(cueDensity) => onChange({ cueDensity })} options={[{ value: "none", label: "None" }, { value: "light", label: "A few" }, { value: "detailed", label: "Detailed" }]} />
          </div>
        </div>
      </div>
    </div>
  );
}
