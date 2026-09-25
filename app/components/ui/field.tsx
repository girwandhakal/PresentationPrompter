"use client";

import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes } from "react";

export function Field({ label, hint, error, optional, children, className, action }: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
  action?: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      <div className="field__head">
        <label className="field__label" htmlFor={id}>{label}{optional && <span className="field__optional">Optional</span>}</label>
        {action}
      </div>
      {control}
      {hint && !error && <p className="field__hint" id={hintId}>{hint}</p>}
      {error && <p className="field__error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unit?: string }>(
  function Input({ className, unit, ...rest }, ref) {
    const input = <input ref={ref} className={["input", className].filter(Boolean).join(" ")} {...rest} />;
    if (!unit) return input;
    return <div className="input-unit">{input}<span className="input-unit__suffix" aria-hidden="true">{unit}</span></div>;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={["input", "textarea", className].filter(Boolean).join(" ")} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={["input", "select", className].filter(Boolean).join(" ")} {...(rest as object)}>{children}</select>;
}
