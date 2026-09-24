"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { initialPresentations } from "./mock-data";
import { NewPresentationFlow } from "./NewPresentationFlow";
import { PresentationWorkspace } from "./PresentationWorkspace";
import { ScriptEditor } from "./ScriptEditor";
import type { AppView, Presentation, Slide } from "./types";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

const STORAGE_KEY = "cueframe-presentations-v2";
const ACTIVE_STORAGE_KEY = "cueframe-active-presentation-v1";

export function PresentationApp({ initialView }: { initialView: AppView }) {
  const [presentations, setPresentations] = useState(initialPresentations);
  const [activeId, setActiveId] = useState(initialPresentations[0].id);
  const [view, setView] = useState<AppView>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedActiveId = window.localStorage.getItem(ACTIVE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Presentation[];
        queueMicrotask(() => setPresentations(parsed));
        if (storedActiveId && parsed.some((presentation) => presentation.id === storedActiveId)) {
          queueMicrotask(() => setActiveId(storedActiveId));
        }
      }
    } catch { /* local storage unavailable */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presentations)); } catch { /* best effort */ }
  }, [presentations]);

  useEffect(() => {
    try { window.localStorage.setItem(ACTIVE_STORAGE_KEY, activeId); } catch { /* best effort */ }
  }, [activeId]);

  const active = useMemo(
    () => presentations.find((p) => p.id === activeId) ?? presentations[0],
    [activeId, presentations],
  );

  function select(id: string) {
    setActiveId(id);
    setEditingTitleId(null);
    setView("project");
  }

  function addGenerated(p: Presentation) {
    setPresentations((cur) => [p, ...cur]);
    setActiveId(p.id);
    setEditingTitleId(null);
    setView("project");
  }

  function rename(id: string, title: string) {
    const next = title.trim();
    if (!next) { setEditingTitleId(null); return; }
    setPresentations((cur) => cur.map((p) => p.id === id ? { ...p, title: next, updated: "Just now" } : p));
    setEditingTitleId(null);
  }

  function duplicate(id: string) {
    const src = presentations.find((p) => p.id === id);
    if (!src) return;
    const copy = { ...src, id: `${src.id}-${Date.now()}`, title: `${src.title} — copy`, updated: "Just now" };
    setPresentations((cur) => [copy, ...cur]);
    setActiveId(copy.id);
    setView("project");
  }

  function remove() {
    if (!deleteId) return;
    const remaining = presentations.filter((p) => p.id !== deleteId);
    setPresentations(remaining.length ? remaining : initialPresentations);
    if (deleteId === activeId) setActiveId((remaining[0] ?? initialPresentations[0]).id);
    setDeleteId(null);
  }

  function saveSlides(slides: Slide[]) {
    setPresentations((cur) => cur.map((p) => p.id === activeId ? { ...p, slides, updated: "Just now" } : p));
  }

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        presentations={presentations}
        activeId={activeId}
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSelect={select}
        onAdd={() => setView("new")}
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

        {view === "new" && <NewPresentationFlow onGenerated={addGenerated} />}

        {view === "project" && active && (
          <PresentationWorkspace
            presentation={active}
            isEditingTitle={editingTitleId === active.id}
            onStartTitleEdit={() => setEditingTitleId(active.id)}
            onCommitTitle={(title) => rename(active.id, title)}
            onCancelTitleEdit={() => setEditingTitleId(null)}
            onEdit={() => setView("editor")}
            onOpenSidebar={() => setMobileOpen(true)}
          />
        )}

        {view === "editor" && active && (
          <ScriptEditor
            key={active.id}
            presentation={active}
            onBack={() => setView("project")}
            onSave={saveSlides}
          />
        )}
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
