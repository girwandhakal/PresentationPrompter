"use client";

import { Menu as MenuIcon, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePref } from "@/lib/prefs";
import { getSyncState, subscribeSync } from "@/lib/store/cloud";
import { useProjects } from "@/lib/store/projects";
import { SharedProjectsNotice } from "../auth/SharedProjectsNotice";
import { IconButton } from "../ui/button";
import { Callout } from "../ui/controls";
import { BrandMark } from "./BrandMark";
import { Sidebar } from "./Sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = usePref("sidebarCollapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loadError, saveError } = useProjects();
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="shell" data-sidebar-collapsed={collapsed}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="shell__main">
        <div className="mobile-bar">
          <IconButton label="Open menu" tooltip={false} onClick={() => setMobileOpen(true)}><MenuIcon /></IconButton>
          <Link href="/home" className="mobile-bar__brand"><BrandMark size={22} /><span>Cueframe</span></Link>
          {!pathname?.endsWith("/setup") && <Link href="/new" className="icon-btn icon-btn--ghost" aria-label="New presentation"><Plus /></Link>}
        </div>
        {(loadError || saveError) && (
          <div className="shell__alert">
            <Callout tone="error" title={loadError ? "Saved presentations couldn't be opened" : "Changes aren't being saved"}>
              {loadError ?? saveError}
            </Callout>
          </div>
        )}
        {sync.error && !loadError && !saveError && (
          <div className="shell__alert">
            <Callout tone="warn" title="Not backed up to your account yet">{sync.error}</Callout>
          </div>
        )}
        <SharedProjectsNotice />
        <main id="main" className="shell__content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
