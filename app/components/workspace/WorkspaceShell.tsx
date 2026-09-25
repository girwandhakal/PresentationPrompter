"use client";

import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { usePresentations } from "./use-presentations";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

type Props = {
  activeId?: string;
  children: ReactNode;
};

export function WorkspaceShell({ activeId, children }: Props) {
  const router = useRouter();
  const { presentations, duplicatePresentation, removePresentation } = usePresentations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  function duplicate(id: string) {
    const copy = duplicatePresentation(id);
    if (copy) router.push(`/p/${copy.id}`);
  }

  function remove() {
    if (!deleteId) return;
    const wasActive = deleteId === activeId;
    removePresentation(deleteId);
    setDeleteId(null);
    if (wasActive) router.push("/");
  }

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        presentations={presentations}
        activeId={activeId ?? ""}
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onAdd={() => { setMobileOpen(false); router.push("/new"); }}
        onDuplicate={duplicate}
        onDelete={setDeleteId}
        onAccount={() => setAccountOpen(true)}
      />

      <div className="app-main">
        <button
          className="mobile-trigger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu size={17} />
        </button>

        {children}
      </div>

      {deleteId && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteId(null)}>
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="modal-eyebrow">Remove presentation</span>
            <h2 id="delete-title">Delete this presentation?</h2>
            <p>This removes the local project, script, and session history from this browser.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Keep it</button>
              <button className="btn btn-danger" onClick={remove}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {accountOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAccountOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="btn-icon modal-close" onClick={() => setAccountOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
            <span className="modal-eyebrow">Account</span>
            <h2 id="account-title">Your Account</h2>
            <p>Presentation preferences are managed here.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setAccountOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
