"use client";

import { Mic, Minus, Plus, Sparkles, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { EXIT, GLIDE, RollingText } from "../ui/motion";

// ── Dictation ───────────────────────────────────────────────────────────────
// Presenters think out loud, so every free-text field can be spoken instead of typed. Uses the
// browser's own speech service where it exists; the button simply doesn't render elsewhere.

type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }>>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

function useDictation(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noSubscribe, () => recognitionClass() !== null, () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => { callback.current = onText; });
  useEffect(() => () => recognition.current?.stop(), []);

  function toggle(current: string) {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const Speech = recognitionClass();
    if (!Speech) return;
    const instance = new Speech();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";
    const prefix = current.trim() ? `${current.trim()} ` : "";
    instance.onresult = (event) => {
      const spoken = Array.from(event.results, (result) => result[0].transcript).join("").trim();
      callback.current(prefix + (prefix ? spoken : spoken.charAt(0).toUpperCase() + spoken.slice(1)));
    };
    instance.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    instance.onerror = () => instance.stop();
    recognition.current = instance;
    instance.start();
    setListening(true);
  }

  return { supported, listening, toggle };
}

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
  const dictation = useDictation(onChange);
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
    <div className="brief-row" data-suggested={suggested || undefined} data-listening={dictation.listening || undefined} data-empty={empty || undefined}>
      <span className="brief-row__icon" aria-hidden="true">{icon}</span>
      <div className="brief-row__body">
        <div className="brief-row__head">
          <label className="brief-row__label" htmlFor={id}>{label}</label>
          {suggested && <span className="brief-tag brief-tag--ai"><Sparkles aria-hidden="true" />Suggested</span>}
          {empty && fallback && <span className="brief-tag">Default</span>}
          <span className="brief-row__tools">
            {dictation.supported && (
              <button
                type="button"
                className="brief-mic"
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? `Stop dictating ${label.toLowerCase()}` : `Dictate ${label.toLowerCase()}`}
                title={dictation.listening ? "Stop" : "Say it instead"}
                onClick={() => dictation.toggle(value)}
              >
                <Mic aria-hidden="true" />
              </button>
            )}
            {onRemove && (
              <button type="button" className="brief-mic" aria-label={`Remove ${label.toLowerCase()}`} title="Remove" onClick={onRemove}>
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
        {dictation.listening && <p className="brief-row__listening" role="status"><span className="listening-bars" aria-hidden="true"><i /><i /><i /><i /></span>Listening… speak naturally, then tap the mic to stop.</p>}
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
              {checked && <m.span layoutId="ring" className="choice-card__ring" transition={GLIDE} aria-hidden="true" />}
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
      <p className="length__sub">{perSlide ? <>About <strong>{perSlide}</strong> per slide</> : " "}</p>
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
        <i key={index} style={{ "--i": index, width: `${width * 0.28}px` } as React.CSSProperties} />
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

/** A miniature teleprompter page showing how much gets written, with Bluebell ticks for cues. */
export function ShapeVisual({ depth, cues }: { depth: "full" | "notes" | "cues"; cues: number }) {
  const lines = SHAPES[depth];
  const cueAt = cues === 0 ? [] : cues === 1 ? [Math.floor(lines.length / 2)] : [1, Math.floor(lines.length / 2), lines.length - 2];
  return (
    <span className="shape-visual" data-depth={depth}>
      {lines.map((width, index) => (
        <i key={index} className={cueAt.includes(index) ? "is-cue" : undefined} style={{ "--w": `${width}%`, "--i": index } as React.CSSProperties} />
      ))}
    </span>
  );
}

/** A spoken sample that re-reads itself, word by word, whenever the voice changes. */
export function VoiceSample({ text, label }: { text: string; label: string }) {
  return (
    <figure className="voice-sample" aria-live="polite">
      <figcaption>{label} sounds like</figcaption>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.blockquote key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: EXIT }}>
          {text.split(/(\s+)/).map((word, index) => word.trim()
            ? <span key={index} className="reveal-word" style={{ "--w": index / 2 } as React.CSSProperties}>{word}</span>
            : word)}
        </m.blockquote>
      </AnimatePresence>
    </figure>
  );
}
