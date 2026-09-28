"use client";

import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { useId, useRef, useState, type ReactNode } from "react";
import { EXIT, GLIDE, RollingText } from "../ui/motion";

// ── Brief rows ──────────────────────────────────────────────────────────────

export type Chip = { label: string; value: string };

/**
 * A free-text answer that reads like the finished brief rather than an empty box: borderless until
 * hovered or focused, grows with its text, and falls back to a sensible default when left blank.
 * Chips offer one-tap answers; "starters" only appear while the field is empty.
 */
export function BriefRow({ icon, label, value, onChange, fallback, placeholder, suggested, chips, starters, maxLength, onRemove, autoFocus }: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
  placeholder?: string;
  suggested?: boolean;
  chips?: Chip[];
  starters?: Chip[];
  maxLength: number;
  onRemove?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const empty = !value.trim();
  const options = empty && starters ? starters : chips;

  function choose(chip: Chip, starter: boolean) {
    onChange(chip.value);
    if (!starter) return;
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  return (
    <div className="brief-row" data-suggested={suggested || undefined} data-empty={empty || undefined}>
      <span className="brief-row__icon" aria-hidden="true">{icon}</span>
      <div className="brief-row__body">
        <div className="brief-row__head">
          <label className="brief-row__label" htmlFor={id}>{label}</label>
          {empty && fallback && <span className="brief-tag">Default</span>}
          <span className="brief-row__tools">
            {onRemove && (
              <button type="button" className="brief-remove" aria-label={`Remove ${label.toLowerCase()}`} title="Remove" onClick={onRemove}>
                <X aria-hidden="true" />
              </button>
            )}
          </span>
        </div>
        <textarea
          ref={input}
          id={id}
          rows={1}
          className="brief-row__input"
          value={value}
          maxLength={maxLength}
          placeholder={fallback ?? placeholder}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        {options && (
          <div className="brief-chips" role="group" aria-label={empty && starters ? `Ways to start the ${label.toLowerCase()}` : `Quick picks for ${label.toLowerCase()}`} data-mode={empty && starters ? "starters" : "picks"}>
            {options.map((chip, index) => (
              <button
                key={chip.label}
                type="button"
                className="brief-chip"
                style={{ "--i": index } as React.CSSProperties}
                aria-pressed={empty && starters ? undefined : chip.value === value}
                onClick={() => choose(chip, Boolean(empty && starters))}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Optional fields stay out of the way as "+ Add" chips until the presenter asks for one. */
export function ExtraFields({ fields, values, onChange }: {
  fields: { key: string; label: string; add: string; icon: ReactNode; placeholder: string; maxLength: number }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const visible = fields.filter((field) => values[field.key]?.trim() || opened.includes(field.key));
  const hidden = fields.filter((field) => !visible.includes(field));
  return (
    <div className="extras">
      <AnimatePresence initial={false}>
        {visible.map((field) => (
          <m.div
            key={field.key}
            className="extras__field"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: EXIT }}
          >
            <BriefRow
              icon={field.icon}
              label={field.label}
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              autoFocus={opened.includes(field.key) && !values[field.key]}
              onChange={(value) => onChange(field.key, value)}
              onRemove={() => {
                onChange(field.key, "");
                setOpened((current) => current.filter((key) => key !== field.key));
              }}
            />
          </m.div>
        ))}
      </AnimatePresence>
      {hidden.length > 0 && (
        <div className="extras__adders">
          <span className="extras__lead">Add context</span>
          {hidden.map((field) => (
            <button key={field.key} type="button" className="brief-chip brief-chip--add" onClick={() => setOpened((current) => [...current, field.key])}>
              <Plus aria-hidden="true" />{field.add}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Choice cards ────────────────────────────────────────────────────────────

/** Visual single choice (ARIA radiogroup, arrow keys move and select). The selection ring glides. */
export function ChoiceCards<T extends string>({ value, onChange, options, label, columns = 3, className }: {
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; title: ReactNode; meta?: ReactNode; description?: ReactNode; visual?: ReactNode; icon?: ReactNode }[];
  label: string;
  columns?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const group = useId();
  const selected = options.findIndex((option) => option.value === value);
  function onKeyDown(event: React.KeyboardEvent) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>;
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = options[(Math.max(0, selected) + keys[event.key] + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={["choice-cards", className].filter(Boolean).join(" ")}
      style={{ "--cols": columns } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      <LayoutGroup id={group}>
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (selected === -1 && index === 0) ? 0 : -1}
              className="choice-card"
              style={{ "--i": index } as React.CSSProperties}
              onClick={() => onChange(option.value)}
            >
              {checked && <m.span layoutId="ring" layoutDependency={option.value} className="choice-card__ring" transition={GLIDE} aria-hidden="true" />}
              {option.visual && <span className="choice-card__visual" aria-hidden="true">{option.visual}</span>}
              <span className="choice-card__head">
                {option.icon && <span className="choice-card__icon" aria-hidden="true">{option.icon}</span>}
                <span className="choice-card__title">{option.title}</span>
                {option.meta && <span className="choice-card__meta">{option.meta}</span>}
              </span>
              {option.description && <span className="choice-card__description">{option.description}</span>}
            </button>
          );
        })}
      </LayoutGroup>
    </div>
  );
}

// ── Length ──────────────────────────────────────────────────────────────────

const LENGTH_PRESETS = [5, 10, 15, 20, 30, 45];
const RULER_MAX = 60;

/**
 * Talk length as something you set, not type: a big rolling readout, a tick ruler you drag (a
 * native range input underneath, so keyboard and screen readers work unchanged), steppers for
 * single minutes, and one-tap common lengths.
 */
export function LengthPicker({ minutes, min, max, onChange, perSlide }: { minutes: number; min: number; max: number; onChange: (minutes: number) => void; perSlide: string | null }) {
  const id = useId();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  const percent = ((Math.min(minutes, RULER_MAX) - min) / (RULER_MAX - min)) * 100;
  return (
    <div className="length">
      <div className="length__readout">
        <button type="button" className="length__step" aria-label="One minute shorter" disabled={minutes <= min} onClick={() => set(minutes - 1)}><Minus aria-hidden="true" /></button>
        <p className="length__value" aria-live="polite">
          <RollingText value={String(minutes)} className="tabular" />
          <span className="length__unit">min</span>
        </p>
        <button type="button" className="length__step" aria-label="One minute longer" disabled={minutes >= max} onClick={() => set(minutes + 1)}><Plus aria-hidden="true" /></button>
      </div>
      {perSlide && <p className="length__sub">About <strong>{perSlide}</strong> per slide</p>}
      <label htmlFor={id} className="sr-only">Total length</label>
      <input
        id={id}
        type="range"
        className="ruler"
        min={min}
        max={RULER_MAX}
        step={1}
        value={Math.min(minutes, RULER_MAX)}
        aria-valuetext={`${minutes} minutes`}
        onChange={(event) => set(Number(event.target.value))}
        style={{ "--fill": `${percent}%` } as React.CSSProperties}
      />
      <div className="length__presets" role="group" aria-label="Common lengths">
        {LENGTH_PRESETS.map((preset) => (
          <button key={preset} type="button" className="brief-chip brief-chip--num" aria-pressed={preset === minutes} onClick={() => set(preset)}>
            {preset}m
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pace ────────────────────────────────────────────────────────────────────

/** Eight "words" light up in turn at the given speaking rate, so faster and slower can be seen. */
export function PaceVisual({ wpm }: { wpm: number }) {
  const beat = 60 / wpm;
  return (
    <span className="pace-visual" style={{ "--beat": `${beat}s` } as React.CSSProperties}>
      {[44, 70, 30, 58, 82, 38, 64, 50].map((width, index) => (
        <i key={index} style={{ "--i": index, width: `${width * 0.2}px` } as React.CSSProperties} />
      ))}
    </span>
  );
}

// ── Script shape ────────────────────────────────────────────────────────────

const SHAPES: Record<"full" | "notes" | "cues", number[]> = {
  full: [94, 88, 97, 72, 90, 84, 60],
  notes: [66, 48, 58, 40],
  cues: [24, 30, 20, 26, 18],
};

/** A miniature teleprompter page showing how much gets written. */
export function ShapeVisual({ depth }: { depth: "full" | "notes" | "cues" }) {
  return (
    <span className="shape-visual" data-depth={depth}>
      {SHAPES[depth].map((width, index) => (
        <i key={index} style={{ "--w": `${width}%`, "--i": index } as React.CSSProperties} />
      ))}
    </span>
  );
}
