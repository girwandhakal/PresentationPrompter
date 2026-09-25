"use client";

import {
  Copy,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Presentation } from "./types";

type Props = {
  presentations: Presentation[];
  activeId: string;
  mobileOpen: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
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
  onAdd,
  onDuplicate,
  onDelete,
  onAccount,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuId(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <>
      {mobileOpen && (
        <button className="sidebar-scrim" onClick={onCloseMobile} aria-label="Close sidebar" />
      )}
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">
            <i /><i /><i />
          </div>
          <span className="sidebar-brand-name">Cueframe</span>
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {/* New presentation */}
        <button
          className="sidebar-new"
          onClick={onAdd}
          aria-label="New presentation"
          title="New presentation"
        >
          <Plus size={14} />
          <span className="sidebar-new-label">New presentation</span>
        </button>

        <p className="sidebar-section-label">Presentations</p>

        {/* Nav list */}
        <nav className="sidebar-nav" aria-label="Presentations">
          {presentations.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <div className={`sidebar-row ${p.id === activeId ? "is-active" : ""}`}>
                <Link
                  className="sidebar-row-main"
                  href={`/p/${p.id}`}
                  title={collapsed ? p.title : undefined}
                  aria-label={collapsed ? p.title : undefined}
                  aria-current={p.id === activeId ? "page" : undefined}
                  onClick={onCloseMobile}
                >
                  <span className="sidebar-item-dot" />
                  <span className="sidebar-item-text">
                    <span className="sidebar-item-title">{p.title}</span>
                    <span className="sidebar-item-meta">{p.updated}</span>
                  </span>
                </Link>
                <button
                  className="sidebar-item-menu"
                  aria-label={`Actions for ${p.title}`}
                  aria-expanded={menuId === p.id}
                  onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                >
                  <MoreHorizontal size={13} />
                </button>
              </div>
              {menuId === p.id && (
                <div className="sidebar-popover" ref={menuRef}>
                  <button onClick={() => { onDuplicate(p.id); setMenuId(null); }}>
                    <Copy /> Duplicate
                  </button>
                  <button onClick={() => { onAdd(); setMenuId(null); }}>
                    <Upload /> Replace slides
                  </button>
                  <button className="is-danger" onClick={() => { onDelete(p.id); setMenuId(null); }}>
                    <Trash2 /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-account"
            onClick={onAccount}
            aria-label="Account settings"
            title={collapsed ? "Account settings" : undefined}
          >
            <span className="sidebar-account-avatar">GD</span>
            <span className="sidebar-account-label">Your account</span>
          </button>
        </div>
      </aside>
    </>
  );
}
