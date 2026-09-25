import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { withoutQaTime } from "../domain/planner";
import type { PresenterSession, Project, ScriptVersion } from "../domain/types";

/**
 * Local-first persistence. Everything a user creates lives in this browser's IndexedDB:
 * project metadata and scripts, slide images as Blobs, script versions, and presenter sessions.
 * This module is the only place that touches IndexedDB, so a sync backend can wrap it later.
 */
interface CueframeDB extends DBSchema {
  projects: { key: string; value: Project };
  blobs: { key: string; value: Blob };
  versions: { key: string; value: ScriptVersion; indexes: { projectId: string } };
  sessions: { key: string; value: PresenterSession; indexes: { projectId: string } };
}

const DB_NAME = "cueframe";
const DB_VERSION = 1;
const MAX_VERSIONS_PER_PROJECT = 30;

let dbPromise: Promise<IDBPDatabase<CueframeDB>> | null = null;

export function db() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local storage for presentations."));
  dbPromise ??= openDB<CueframeDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore("projects", { keyPath: "id" });
      database.createObjectStore("blobs");
      database.createObjectStore("versions", { keyPath: "id" }).createIndex("projectId", "projectId");
      database.createObjectStore("sessions", { keyPath: "id" }).createIndex("projectId", "projectId");
    },
    blocking() {
      // Another tab is upgrading the schema; close so it can proceed, and reopen lazily.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });
  return dbPromise;
}

// ── Change notifications across tabs ────────────────────────────────────────

export type DataEvent = { type: "project"; id: string } | { type: "project-deleted"; id: string } | { type: "reset" };

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cueframe:data") : null;

export function notify(event: DataEvent) {
  channel?.postMessage(event);
}

export function subscribe(listener: (event: DataEvent) => void) {
  if (!channel) return () => {};
  const handler = (message: MessageEvent<DataEvent>) => listener(message.data);
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

// ── Projects ────────────────────────────────────────────────────────────────

/** Brings a stored project up to the current shape. Every read goes through here. */
function upgrade(project: Project): Project {
  if (!project.brief.qaMinutes && !project.generatedWith?.qaMinutes) return project;
  return { ...project, brief: withoutQaTime(project.brief), generatedWith: project.generatedWith && withoutQaTime(project.generatedWith) };
}

export async function listProjects() {
  const projects = (await (await db()).getAll("projects")).map(upgrade);
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string) {
  const project = await (await db()).get("projects", id);
  return project && upgrade(project);
}

export async function putProject(project: Project) {
  await (await db()).put("projects", project);
  notify({ type: "project", id: project.id });
}

export async function deleteProject(project: Project) {
  const database = await db();
  const tx = database.transaction(["projects", "blobs", "versions", "sessions"], "readwrite");
  await tx.objectStore("projects").delete(project.id);
  for (const slide of project.slides) {
    await tx.objectStore("blobs").delete(slide.imageKey);
    await tx.objectStore("blobs").delete(slide.thumbKey);
  }
  for (const key of await tx.objectStore("versions").index("projectId").getAllKeys(project.id)) await tx.objectStore("versions").delete(key);
  for (const key of await tx.objectStore("sessions").index("projectId").getAllKeys(project.id)) await tx.objectStore("sessions").delete(key);
  await tx.done;
  notify({ type: "project-deleted", id: project.id });
}

// ── Slide images ────────────────────────────────────────────────────────────

export async function putBlobs(entries: [string, Blob][]) {
  const tx = (await db()).transaction("blobs", "readwrite");
  for (const [key, blob] of entries) await tx.store.put(blob, key);
  await tx.done;
}

export async function getBlob(key: string) {
  if (!key) return undefined;
  return (await db()).get("blobs", key);
}

export async function deleteBlobs(keys: string[]) {
  const tx = (await db()).transaction("blobs", "readwrite");
  for (const key of keys) if (key) await tx.store.delete(key);
  await tx.done;
}

// ── Script versions ─────────────────────────────────────────────────────────

export async function addVersion(version: ScriptVersion) {
  const database = await db();
  await database.put("versions", version);
  const all = (await database.getAllFromIndex("versions", "projectId", version.projectId)).sort((a, b) => b.createdAt - a.createdAt);
  for (const stale of all.slice(MAX_VERSIONS_PER_PROJECT)) await database.delete("versions", stale.id);
}

export async function listVersions(projectId: string) {
  return (await (await db()).getAllFromIndex("versions", "projectId", projectId)).sort((a, b) => b.createdAt - a.createdAt);
}

// ── Presenter sessions ──────────────────────────────────────────────────────

export async function putSession(session: PresenterSession) {
  await (await db()).put("sessions", session);
}

export async function getSession(id: string) {
  return (await db()).get("sessions", id);
}

export async function listSessions(projectId: string) {
  return (await (await db()).getAllFromIndex("sessions", "projectId", projectId)).sort((a, b) => b.startedAt - a.startedAt);
}
