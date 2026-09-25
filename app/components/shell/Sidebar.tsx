"use client";

import { PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDuration, pluralize } from "@/lib/domain/format";
import { hasScript, projectSpokenSeconds } from "@/lib/domain/planner";
import type { Project } from "@/lib/domain/types";
import { useProjects } from "@/lib/store/projects";
import { ProjectMenu } from "../project/ProjectMenu";
import { IconButton } from "../ui/button";
import { Skeleton } from "../ui/controls";
import { BrandMark } from "./BrandMark";

export function projectStatus(project: Project) {
  if (project.generation.status === "running") return "Writing script…";
  if (project.generation.status === "failed" && !hasScript(project)) return "Script not finished";
  if (project.status === "setup") return project.analysis.status === "running" ? "Reading slides…" : "Needs setup";
  return `${pluralize(project.slides.length, "slide")} · ${formatDuration(projectSpokenSeconds(project))}`;
}

function groupByRecency(projects: Project[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const weekAgo = startOfToday - 6 * 86_400_000;
  const groups: { label: string; items: Project[] }[] = [
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const project of projects) {
    if (project.updatedAt >= startOfToday) groups[0].items.push(project);
    else if (project.updatedAt >= weekAgo) groups[1].items.push(project);
    else groups[2].items.push(project);
  }
  return groups.filter((group) => group.items.length);
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { projects, ready } = useProjects();
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const activeId = params?.id;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? projects.filter((project) => project.title.toLowerCase().includes(needle)) : projects;
  }, [projects, query]);
  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onCloseMobile} aria-hidden="true" />}
      <aside className="sidebar" data-collapsed={collapsed} data-mobile-open={mobileOpen} aria-label="Presentations">
        <div className="sidebar__top">
          <Link href="/" className="sidebar__brand" aria-label="Cueframe home" onClick={onCloseMobile}>
            <BrandMark />
            <span className="sidebar__brand-name">Cueframe</span>
          </Link>
          <IconButton
            className="sidebar__collapse"
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            tooltip={collapsed ? "right" : "bottom"}
            size="sm"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
          <IconButton className="sidebar__close" label="Close menu" size="sm" tooltip={false} onClick={onCloseMobile}>
            <X />
          </IconButton>
        </div>

        <div className="sidebar__actions">
          <Link
            href="/new"
            className={`sidebar__new${pathname === "/new" ? " is-current" : ""}`}
            onClick={onCloseMobile}
            data-tooltip={collapsed ? "New presentation" : undefined}
            data-tooltip-side="right"
            aria-label={collapsed ? "New presentation" : undefined}
          >
            <Plus aria-hidden="true" />
            <span className="sidebar__label">New presentation</span>
          </Link>
          {projects.length > 4 && (
            <label className="sidebar__search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search presentations</span>
              <input type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          )}
        </div>

        <nav className="sidebar__list" aria-label="Your presentations">
          {!ready && (
            <div className="sidebar__loading">
              {[72, 56, 64].map((width) => <Skeleton key={width} width={`${width}%`} height={12} />)}
            </div>
          )}
          {ready && !projects.length && <p className="sidebar__empty">Your presentations will appear here.</p>}
          {ready && projects.length > 0 && !filtered.length && <p className="sidebar__empty">No presentations match “{query}”.</p>}
          {groups.map((group) => (
            <section key={group.label} className="sidebar__group">
              <h2 className="sidebar__group-label">{group.label}</h2>
              <ul>
                {group.items.map((project) => (
                  <li key={project.id} className="sidebar__item" data-active={project.id === activeId}>
                    <Link
                      href={`/p/${project.id}`}
                      className="sidebar__link"
                      aria-current={project.id === activeId ? "page" : undefined}
                      onClick={onCloseMobile}
                    >
                      <span className="sidebar__item-title">{project.title}</span>
                      <span className="sidebar__item-meta">
                        {project.generation.status === "running" && <span className="sidebar__pulse" aria-hidden="true" />}
                        {projectStatus(project)}
                      </span>
                    </Link>
                    <div className="sidebar__item-menu">
                      <ProjectMenu project={project} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="sidebar__footer">
          <Link
            href="/settings"
            className={`sidebar__footer-link${pathname === "/settings" ? " is-current" : ""}`}
            onClick={onCloseMobile}
            data-tooltip={collapsed ? "Settings" : undefined}
            data-tooltip-side="right"
            aria-label={collapsed ? "Settings" : undefined}
          >
            <Settings aria-hidden="true" />
            <span className="sidebar__label">Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
