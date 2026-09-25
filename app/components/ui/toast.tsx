"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void }; tone: "default" | "error" };
export type ToastInput = { message: string; action?: Toast["action"]; tone?: Toast["tone"]; duration?: number };

const ToastContext = createContext<((toast: ToastInput | string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback((input: ToastInput | string) => {
    const toast = typeof input === "string" ? { message: input } : input;
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message: toast.message, action: toast.action, tone: toast.tone ?? "default" }]);
    window.setTimeout(() => dismiss(id), toast.duration ?? (toast.action ? 8000 : 4500));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
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
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast() must be used inside <ToastProvider>.");
  return context;
}
