"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "quiet";
type Size = "sm" | "md" | "lg";

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; trailing?: ReactNode; block?: boolean };

function classes({ variant = "secondary", size = "md", block }: Common, extra?: string) {
  return ["btn", `btn--${variant}`, `btn--${size}`, block ? "btn--block" : "", extra ?? ""].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Common & { loading?: boolean }>(
  function Button({ variant, size, icon, trailing, block, loading, className, children, disabled, type = "button", ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={classes({ variant, size, block }, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : icon}
        {children != null && <span className="btn__label">{children}</span>}
        {trailing}
      </button>
    );
  },
);

export function ButtonLink({ variant, size, icon, trailing, block, className, children, ...rest }: ComponentProps<typeof Link> & Common) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {icon}
      {children != null && <span className="btn__label">{children}</span>}
      {trailing}
    </Link>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: Size; variant?: "ghost" | "secondary" | "primary"; tooltip?: "top" | "bottom" | "left" | "right" | false }>(
  function IconButton({ label, size = "md", variant = "ghost", tooltip = "bottom", className, children, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        data-tooltip={tooltip ? label : undefined}
        data-tooltip-side={tooltip || undefined}
        className={["icon-btn", `icon-btn--${size}`, `icon-btn--${variant}`, className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
