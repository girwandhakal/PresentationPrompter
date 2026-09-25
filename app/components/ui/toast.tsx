"use client";

import { X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { stableContext } from "@/lib/stable-context";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void }; tone: "default" | "error"; duration: number };
export type ToastInput = { message: string; action?: Toast["action"]; tone?: Toast["tone"]; duration?: number };

const ToastContext = stableContext<((toast: ToastInput | string) => void) | null>("toast", null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback((input: ToastInput | string) => {
    const toast = typeof input === "string" ? { message: input } : input;
    const id = nextId.current++;
    const duration = toast.duration ?? (toast.action ? 8000 : 4500);
    setToasts((current) => [...current.slice(-2), { id, message: toast.message, action: toast.action, tone: toast.tone ?? "default", duration }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((toast) => (
          <m.div
            key={toast.id}
            layout
            className={`toast toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.16, ease: [0.55, 0, 1, 0.45] } }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.22 }}
          >
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X /></button>
            <span className="toast__timer" style={{ "--toast-duration": `${toast.duration}ms` } as React.CSSProperties} aria-hidden="true" />
          </m.div>
        ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast() must be used inside <ToastProvider>.");
  return context;
}
