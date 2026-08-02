"use client";

import {
  ChevronLeft,
  Copy,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Presentation } from "./types";

type Props = {
  presentations: Presentation[];
  activeId: string;
  mobileOpen: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAccount: () => void;
};

export function WorkspaceSidebar({
  presentations,
  activeId,
  mobileOpen,
  collapsed,
  onCloseMobile,
  onToggleCollapse,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onAccount,
}: Props) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const filtered = presentations.filter((presentation) =>
    presentation.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      {mobileOpen && <button className="sidebar-scrim" onClick={onCloseMobile} aria-label="Close presentation sidebar" />}
      <aside className={`workspace-sidebar ${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div>
            <strong>Cueframe</strong>
          </div>
          <button className="icon-button sidebar-close" onClick={onCloseMobile} aria-label="Close sidebar">
            <ChevronLeft size={18} />
          </button>
          <button className="icon-button sidebar-toggle" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <button className="add-presentation" onClick={onAdd} aria-label="Add presentation" title="Add presentation"><Plus size={21} /></button>

        <label className="sidebar-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search presentations</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        </label>

        <nav className="presentation-list" aria-label="Presentations">
          {filtered.map((presentation) => (
            <div className={`presentation-row ${presentation.id === activeId ? "is-active" : ""}`} key={presentation.id}>
              <button
                className="presentation-row__main"
                aria-label={collapsed ? presentation.title : undefined}
                title={collapsed ? presentation.title : undefined}
                onClick={() => {
                  onSelect(presentation.id);
                  onCloseMobile();
                }}
              >
                <span className="presentation-row__dot" />
                <span>
                  <strong>{presentation.title}</strong>
                  <small>{presentation.updated}</small>
                </span>
              </button>
              <button
                className="presentation-row__menu"
                aria-label={`Actions for ${presentation.title}`}
                aria-expanded={menuId === presentation.id}
                onClick={() => setMenuId(menuId === presentation.id ? null : presentation.id)}
              >
                <MoreHorizontal size={17} />
              </button>
              {menuId === presentation.id && (
                <div className="project-menu glass-popover" ref={menuRef}>
                  <button onClick={() => { onDuplicate(presentation.id); setMenuId(null); }}><Copy /> Duplicate</button>
                  <button onClick={onAdd}><Upload /> Replace slides</button>
                  <button className="is-danger" onClick={() => { onDelete(presentation.id); setMenuId(null); }}><Trash2 /> Delete</button>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="profile-chip" onClick={onAccount} aria-label="Open your account settings">
            <span>GD</span>
            <div><strong>Your Account</strong></div>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
