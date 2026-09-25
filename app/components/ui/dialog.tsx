"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./button";

/**
 * Modal dialog built on the native <dialog> element: focus is contained, the page behind is inert,
 * and Escape closes it. `variant="sheet"` slides in from the right edge. Closing plays a short exit
 * (styled by `.dialog[data-closing]`) before the native element closes.
 */
const EXIT_MS = { center: 150, sheet: 220 } as const;

export function Dialog({ open, onClose, title, description, children, footer, size = "md", variant = "center", dismissible = true, className }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "center" | "sheet";
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  // Content stays rendered while the exit animation plays.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      delete dialog.dataset.closing;
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dialog.dataset.closing = "";
    const timer = window.setTimeout(() => {
      delete dialog.dataset.closing;
      dialog.close();
      setShown(false);
    }, reduced ? 0 : EXIT_MS[variant]);
    return () => window.clearTimeout(timer);
  }, [open, variant]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [dismissible]);

  return (
    <dialog
      ref={ref}
      className={["dialog", `dialog--${variant}`, `dialog--${size}`, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      {shown && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <div>
              <h2 className="dialog__title" id={titleId}>{title}</h2>
              {description && <p className="dialog__description" id={descriptionId}>{description}</p>}
            </div>
            {dismissible && <IconButton label="Close" size="sm" tooltip={false} onClick={onClose}><X /></IconButton>}
          </header>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
