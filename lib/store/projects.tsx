"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authEnabled } from "../firebase/config";
import { stableContext } from "../stable-context";
import { shortId } from "../domain/factory";
import type { Project, ScriptVersion } from "../domain/types";
import * as store from "./db";
import { aiLockName } from "../ai/lock";
import { releaseAllBlobUrls, releaseBlobUrls } from "./blob-url";
import { migrateLegacyStorage } from "./migrate";

type Updater = (project: Project) => Project;

/** How long a missing project waits on the first cloud sync before it is reported as missing. */
const FIRST_SYNC_WAIT_MS = 8000;

type ProjectsStore = {
  ready: boolean;
  /**
   * True until this page's first cloud sync settles (or FIRST_SYNC_WAIT_MS passes). On a new
   * device the account's presentations arrive then, so "not found" must wait for it.
   */
  syncing: boolean;
  loadError: string | null;
  saveError: string | null;
  projects: Project[];
  get: (id: string) => Project | undefined;
  create: (project: Project, blobs: [string, Blob][]) => Promise<void>;
  /**
   * Applies `updater` to the latest in-memory project and persists it. Resolves once written.
   * `touch: false` keeps `updatedAt`; `sync: false` saves only in this browser (transient state).
   */
  update: (id: string, updater: Updater, options?: { touch?: boolean; sync?: boolean }) => Promise<Project | undefined>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<Project | undefined>;
  saveVersion: (id: string, label: string) => Promise<void>;
  restoreVersion: (id: string, version: ScriptVersion) => Promise<void>;
  reload: () => Promise<void>;
};

const ProjectsContext = stableContext<ProjectsStore | null>("projects", null);

function sortProjects(values: Iterable<Project>) {
  return [...values].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const records = useRef(new Map<string, Project>());
  const chains = useRef(new Map<string, Promise<void>>());
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(authEnabled);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const commit = useCallback(() => setProjects(sortProjects(records.current.values())), []);

  const reload = useCallback(async () => {
    try {
      const loaded = await store.listProjects();
      const live = await liveAiRuns();
      records.current = new Map(loaded.map((project) => [project.id, recoverInterrupted(project, live)]));
      commit();
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Saved presentations could not be opened.");
    } finally {
      setReady(true);
    }
  }, [commit]);

  /** Pulls the account's cloud copy after local data is on screen; failures show as sync status. */
  const syncCloud = useCallback(async () => {
    try {
      if (await store.syncWithCloud()) await reload();
    } catch { /* reported through the cloud sync state */ }
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await migrateLegacyStorage(); } catch { /* migration is best effort */ }
      if (cancelled) return;
      await reload();
      if (cancelled) return;
      await Promise.race([syncCloud(), new Promise((resolve) => setTimeout(resolve, FIRST_SYNC_WAIT_MS))]);
      if (!cancelled) setSyncing(false);
    })();
    const online = () => void syncCloud();
    window.addEventListener("online", online);
    return () => {
      cancelled = true;
      window.removeEventListener("online", online);
    };
  }, [reload, syncCloud]);

  useEffect(() => store.subscribe(async (event) => {
    if (event.type === "reset") {
      releaseAllBlobUrls();
      await reload();
      return void syncCloud();
    }
    if (event.type === "project-deleted") {
      records.current.delete(event.id);
      return commit();
    }
    const fresh = await store.getProject(event.id);
    if (fresh) records.current.set(fresh.id, fresh);
    commit();
  }), [commit, reload, syncCloud]);

  const persist = useCallback((id: string, sync = true) => {
    const previous = chains.current.get(id) ?? Promise.resolve();
    const next = previous.then(async () => {
      const latest = records.current.get(id);
      if (!latest) return;
      try {
        await store.putProject(latest, { sync });
        setSaveError(null);
      } catch (error) {
        setSaveError(error instanceof DOMException && error.name === "QuotaExceededError"
          ? "This browser is out of storage space. Delete an older presentation to keep saving."
          : "Changes could not be saved in this browser.");
        throw error;
      }
    });
    chains.current.set(id, next.catch(() => {}));
    return next;
  }, []);

  const get = useCallback((id: string) => projects.find((project) => project.id === id), [projects]);

  const create = useCallback(async (project: Project, blobs: [string, Blob][]) => {
    await store.putBlobs(blobs);
    records.current.set(project.id, project);
    commit();
    await persist(project.id);
  }, [commit, persist]);

  const update = useCallback(async (id: string, updater: Updater, { touch = true, sync = true } = {}) => {
    const current = records.current.get(id);
    if (!current) return undefined;
    const next = updater(current);
    if (next === current) return current;
    const saved = touch ? { ...next, updatedAt: Date.now() } : next;
    records.current.set(id, saved);
    commit();
    await persist(id, sync);
    return saved;
  }, [commit, persist]);

  const remove = useCallback(async (id: string) => {
    const current = records.current.get(id);
    if (!current) return;
    await chains.current.get(id);
    await store.deleteProject(current);
    releaseBlobUrls(current.slides.flatMap((slide) => [slide.imageKey, slide.thumbKey]));
    records.current.delete(id);
    commit();
  }, [commit]);

  const duplicate = useCallback(async (id: string) => {
    const source = records.current.get(id);
    if (!source) return undefined;
    const now = Date.now();
    const copy: Project = structuredClone({ ...source, id: shortId(), title: `${source.title} (copy)`, createdAt: now, updatedAt: now, lastPresentedAt: null, generation: { status: "idle" } });
    const blobs: [string, Blob][] = [];
    for (const slide of copy.slides) {
      for (const field of ["imageKey", "thumbKey"] as const) {
        const blob = await store.getBlob(slide[field]);
        if (!blob) continue;
        const key = `${copy.id}/${slide.id}/${field === "imageKey" ? "image" : "thumb"}`;
        blobs.push([key, blob]);
        slide[field] = key;
      }
    }
    await create(copy, blobs);
    return copy;
  }, [create]);

  const saveVersion = useCallback(async (id: string, label: string) => {
    const project = records.current.get(id);
    if (!project) return;
    await store.addVersion({
      id: shortId(12),
      projectId: id,
      createdAt: Date.now(),
      label,
      slides: project.slides.map((slide) => ({ slideId: slide.id, script: structuredClone(slide.script) })),
    });
  }, []);

  const restoreVersion = useCallback(async (id: string, version: ScriptVersion) => {
    await saveVersion(id, "Before restoring an earlier version");
    const scripts = new Map(version.slides.map((entry) => [entry.slideId, entry.script]));
    await update(id, (project) => ({
      ...project,
      slides: project.slides.map((slide) => scripts.has(slide.id) ? { ...slide, script: structuredClone(scripts.get(slide.id)!) } : slide),
    }));
  }, [saveVersion, update]);

  const value = useMemo<ProjectsStore>(() => ({
    ready, syncing, loadError, saveError, projects, get, create, update, remove, duplicate, saveVersion, restoreVersion, reload,
  }), [ready, syncing, loadError, saveError, projects, get, create, update, remove, duplicate, saveVersion, restoreVersion, reload]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

/** Names of AI runs that some open tab is actively holding a lock for. */
async function liveAiRuns() {
  try {
    const state = typeof navigator !== "undefined" && navigator.locks ? await navigator.locks.query() : null;
    return new Set((state?.held ?? []).map((lock) => lock.name ?? ""));
  } catch {
    return new Set<string>();
  }
}

/**
 * A run left "running" by a closed tab can never finish; surface it as resumable. Runs another open
 * tab still holds a lock for are left alone.
 */
function recoverInterrupted(project: Project, live: Set<string>): Project {
  let next = project;
  if (project.generation.status === "running" && !live.has(aiLockName("generate", project.id))) {
    next = { ...next, generation: { status: "failed", error: "Script generation was interrupted before it finished.", at: Date.now() } };
  }
  if (project.analysis.status === "running" && !live.has(aiLockName("analyze", project.id))) next = { ...next, analysis: { status: "idle" } };
  return next;
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error("useProjects() must be used inside <ProjectsProvider>.");
  return context;
}

export function useProject(id: string) {
  const { get, ready } = useProjects();
  return { project: get(id), ready };
}
