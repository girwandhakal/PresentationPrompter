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
      if (stored) {
        const parsed = JSON.parse(stored) as Presentation[];
        queueMicrotask(() => setPresentations(parsed));
      }
    } catch {
      // The sample workspace remains available when local storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presentations)); } catch { /* local preferences are best effort */ }
  }, [presentations]);

  const active = useMemo(
    () => presentations.find((presentation) => presentation.id === activeId) ?? presentations[0],
    [activeId, presentations],
  );

  function select(id: string) {
    setActiveId(id);
    setEditingTitleId(null);
    setView("project");
  }

  function addGenerated(presentation: Presentation) {
    setPresentations((current) => [presentation, ...current]);
    setActiveId(presentation.id);
    setEditingTitleId(null);
    setView("project");
  }

  function rename(id: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setEditingTitleId(null);
      return;
    }
    setPresentations((current) => current.map((item) => item.id === id ? { ...item, title: nextTitle, updated: "Just now" } : item));
    setEditingTitleId(null);
  }

  function duplicate(id: string) {
    const source = presentations.find((item) => item.id === id);
    if (!source) return;
    const copy = { ...source, id: `${source.id}-${Date.now()}`, title: `${source.title} — copy`, updated: "Just now" };
    setPresentations((current) => [copy, ...current]);
    setActiveId(copy.id);
    setView("project");
  }

  function remove() {
    if (!deleteId) return;
    const remaining = presentations.filter((item) => item.id !== deleteId);
    setPresentations(remaining.length ? remaining : initialPresentations);
    if (deleteId === activeId) setActiveId((remaining[0] ?? initialPresentations[0]).id);
    setDeleteId(null);
  }

  function saveSlides(slides: Slide[]) {
    setPresentations((current) => current.map((item) => item.id === activeId ? { ...item, slides, updated: "Just now" } : item));
  }

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        presentations={presentations}
        activeId={activeId}
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        onSelect={select}
        onAdd={() => setView("new")}
        onDuplicate={duplicate}
        onDelete={setDeleteId}
        onAccount={() => setAccountOpen(true)}
      />
      <div className="app-main">
        <button className="floating-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open presentation sidebar"><Menu /></button>
        {view === "new" && <NewPresentationFlow onGenerated={addGenerated} />}
        {view === "project" && active && <PresentationWorkspace presentation={active} isEditingTitle={editingTitleId === active.id} onStartTitleEdit={() => setEditingTitleId(active.id)} onCommitTitle={(title) => rename(active.id, title)} onCancelTitleEdit={() => setEditingTitleId(null)} onEdit={() => setView("editor")} onOpenSidebar={() => setMobileOpen(true)} />}
        {view === "editor" && active && <ScriptEditor key={active.id} presentation={active} onBack={() => setView("project")} onSave={saveSlides} onOpenSidebar={() => setMobileOpen(true)} />}
      </div>

      {deleteId && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteId(null)}>
          <div className="modal glass-panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="eyebrow">Remove presentation</span><h2 id="delete-title">Delete this presentation?</h2><p>This removes the local project, script, and session history from this browser.</p>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteId(null)}>Keep it</button><button className="danger-button" onClick={remove}>Delete presentation</button></div>
          </div>
        </div>
      )}

      {accountOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAccountOpen(false)}>
          <div className="modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setAccountOpen(false)} aria-label="Close"><X /></button>
            <span className="eyebrow">Account</span><h2 id="account-title">Your Account</h2>
            <p>Presentation preferences are managed here.</p>
            <div className="modal-actions"><button className="start-button" onClick={() => setAccountOpen(false)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
