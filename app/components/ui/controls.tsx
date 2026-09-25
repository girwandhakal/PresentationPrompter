"use client";

import { AlertCircle, Info, LoaderCircle } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

/** Single-choice segmented control (ARIA radiogroup with arrow-key navigation). */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", id }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; description?: string }[];
  label: string;
  size?: "sm" | "md";
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(event: React.KeyboardEvent) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>;
    if (!(event.key in keys)) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + keys[event.key] + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }
  return (
    <div ref={ref} id={id} role="radiogroup" aria-label={label} className={`segmented segmented--${size}`} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          title={option.description}
          className="segmented__option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const generated = useId();
  const switchId = id ?? generated;
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <label htmlFor={switchId} className="switch-row__label">{label}</label>
        {description && <p className="switch-row__description">{description}</p>}
      </div>
      <button id={switchId} type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function Slider({ value, onChange, min, max, step = 1, label, format, id }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (value: number) => string;
  id?: string;
}) {
  const generated = useId();
  const sliderId = id ?? generated;
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={sliderId} className="slider__label">{label}</label>
        <output htmlFor={sliderId} className="slider__value tabular">{format ? format(value) : value}</output>
      </div>
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format ? format(value) : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${percent}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label, idPrefix }: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: ReactNode; badge?: ReactNode }[];
  label: string;
  idPrefix: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(event: React.KeyboardEvent) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === value);
    onChange(tabs[(index + delta + tabs.length) % tabs.length].value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus());
  }
  return (
    <div ref={ref} role="tablist" aria-label={label} className="tabs" onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.value}`}
          aria-controls={`${idPrefix}-panel-${tab.value}`}
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.badge != null && <span className="tabs__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, value, children, className }: { idPrefix: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${value}`} aria-labelledby={`${idPrefix}-tab-${value}`} className={className} tabIndex={0}>
      {children}
    </div>
  );
}

export function Callout({ tone = "info", title, children, action }: { tone?: "info" | "warn" | "error"; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === "info" ? Info : AlertCircle;
  return (
    <div className={`callout callout--${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon className="callout__icon" aria-hidden="true" />
      <div className="callout__body">
        {title && <p className="callout__title">{title}</p>}
        {children && <div className="callout__text">{children}</div>}
      </div>
      {action && <div className="callout__action">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner({ label = "Loading", size = 18 }: { label?: string; size?: number }) {
  return <LoaderCircle className="spin spinner" width={size} height={size} role="img" aria-label={label} />;
}

export function Skeleton({ width, height = 14, radius, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={["skeleton", className].filter(Boolean).join(" ")} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      <h2 className="empty-state__title">{title}</h2>
      {children && <div className="empty-state__text">{children}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

/** Horizontal meter comparing an actual value to a target. Text alternative is always supplied. */
export function Meter({ value, target, label, className }: { value: number; target: number; label: string; className?: string }) {
  const ratio = target > 0 ? value / target : 0;
  const state = ratio > 1.15 ? "over" : ratio < 0.7 ? "under" : "fit";
  return (
    <div className={["meter", `meter--${state}`, className].filter(Boolean).join(" ")} role="img" aria-label={label}>
      <span className="meter__fill" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      {ratio > 1 && <span className="meter__over" style={{ width: `${Math.min(100, (ratio - 1) * 100)}%` }} />}
    </div>
  );
}
