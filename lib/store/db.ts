import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import { shortId } from "../domain/factory";
import { withoutQaTime } from "../domain/planner";
import type { PresenterSession, Project, ScriptVersion } from "../domain/types";
import * as cloud from "./cloud";

/**
 * Local-first persistence. Everything a user creates lives in this browser's IndexedDB:
 * project metadata and scripts, slide images as Blobs, script versions, and presenter sessions.
 * This module is the only place that touches IndexedDB, so a sync backend can wrap it later.
 * Each signed-in account gets its own database, so someone else signing in on the same browser
 * never sees another account's presentations, and every write is mirrored to that account's cloud
 * copy (cloud.ts).
 */
interface CueframeDB extends DBSchema {
  projects: { key: string; value: Project };
  blobs: { key: string; value: Blob };
  versions: { key: string; value: ScriptVersion; indexes: { projectId: string } };
  sessions: { key: string; value: PresenterSession; indexes: { projectId: string } };
  /** Project writes and deletions not yet confirmed by the account copy; retried on the next sync. */
  outbox: { key: string; value: OutboxEntry };
  /** Sync bookkeeping, under the single key "sync". */
  meta: { key: string; value: SyncMeta };
}

/** `rev` identifies one local write, so an older upload finishing never clears a newer entry. */
type OutboxEntry = { id: string; rev: string; deleted?: Project };
/** Where the last sync left off, and which projects the account copy is known to hold. */
type SyncMeta = { cursor: cloud.SyncCursor | null; remote: string[] };

/** Used when sign-in is off, and holds presentations saved before sign-in existed. */
const SHARED_DB_NAME = "cueframe";
const DB_VERSION = 2;
const MAX_VERSIONS_PER_PROJECT = 30;
const STORES = ["projects", "blobs", "versions", "sessions"] as const;

let owner: string | null = null;
let dbPromise: Promise<IDBPDatabase<CueframeDB>> | null = null;

const OWNER_KEY = "cueframe:owner";

/**
 * Points every read and write at one account's database (null: the shared, signed-out one), and
 * remembers the account for the audience window, which opens that database without signing in.
 */
export function setStoreOwner(uid: string | null) {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
    else localStorage.removeItem(OWNER_KEY);
  } catch { /* storage blocked: the audience window then shows the shared database */ }
  if (uid === owner) return;
  owner = uid;
  void dbPromise?.then((database) => database.close()).catch(() => {});
  dbPromise = null;
}

/** Whether this browser has completed a cloud sync for the current account before. */
export async function hasSyncedBefore() {
  if (!mirror()) return true;
  return Boolean(await (await db()).get("meta", "sync"));
}

/** The account the workspace in this browser last opened, until it signs out. */
export function rememberedStoreOwner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** The account whose cloud copy mirrors local writes, when sign-in is on. */
const mirror = () => (owner && cloud.cloudEnabled() ? owner : null);

export function db() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local storage for presentations."));
  dbPromise ??= openStore(owner ? `cueframe:user:${owner}` : SHARED_DB_NAME);
  return dbPromise;
}

function openStore(name: string) {
  return openDB<CueframeDB>(name, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("projects", { keyPath: "id" });
        database.createObjectStore("blobs");
        database.createObjectStore("versions", { keyPath: "id" }).createIndex("projectId", "projectId");
        database.createObjectStore("sessions", { keyPath: "id" }).createIndex("projectId", "projectId");
      }
      if (oldVersion < 2) {
        database.createObjectStore("outbox", { keyPath: "id" });
        database.createObjectStore("meta");
      }
    },
    blocking() {
      // Another tab is upgrading the schema; close so it can proceed, and reopen lazily.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });
}

// ── Presentations saved before sign-in ──────────────────────────────────────

async function openShared() {
  if (typeof indexedDB === "undefined") return null;
  // Don't create the shared database just to find out it's empty.
  if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((info) => info.name === SHARED_DB_NAME)) return null;
  return openStore(SHARED_DB_NAME);
}

/** How many presentations in the shared, signed-out database could move into this account. */
export async function sharedProjectCount() {
  if (!owner) return 0;
  const shared = await openShared();
  if (!shared) return 0;
  try {
    return await shared.count("projects");
  } finally {
    shared.close();
  }
}

/** Copies everything from the shared database into the signed-in account's, then removes it. */
export async function moveSharedProjects() {
  if (!owner) throw new Error("Sign in before moving presentations.");
  const shared = await openShared();
  if (!shared) return;
  const target = await db();
  try {
    for (const store of STORES) {
      for (const key of await shared.getAllKeys(store)) {
        const value = await shared.get(store, key);
        if (value === undefined) continue;
        // Blobs are stored out-of-line (explicit key); the other stores key by their `id` field.
        if (store === "blobs") await target.put("blobs", value as Blob, key as string);
        else await target.put(store, value as never);
      }
    }
  } finally {
    shared.close();
  }
  await deleteDB(SHARED_DB_NAME);
  notify({ type: "reset" });
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

/**
 * Saves a project locally and, unless `sync` is false, mirrors it to the account. Transient states
 * (a run in progress, its phase) stay local: another device can't act on them, and each would
 * cost a write.
 */
export async function putProject(project: Project, { sync = true } = {}) {
  const database = await db();
  const uid = sync ? mirror() : null;
  const rev = shortId(12);
  if (uid) {
    const tx = database.transaction(["projects", "outbox"], "readwrite");
    await tx.objectStore("projects").put(project);
    await tx.objectStore("outbox").put({ id: project.id, rev });
    await tx.done;
  } else {
    await database.put("projects", project);
  }
  notify({ type: "project", id: project.id });
  if (uid) cloud.saveProject(uid, project, () => void settleOutbox(database, project.id, rev));
}

/**
 * Clears an outbox entry once the account copy has the write it recorded. Uses the database the
 * entry was written to: after a sign-out db() would open (and create) the signed-out one instead.
 */
async function settleOutbox(database: IDBPDatabase<CueframeDB>, id: string, rev: string) {
  try {
    const tx = database.transaction("outbox", "readwrite");
    if ((await tx.store.get(id))?.rev === rev) await tx.store.delete(id);
    await tx.done;
  } catch { /* the entry stays and is retried at the next sync */ }
}

export async function deleteProject(project: Project) {
  const database = await db();
  const uid = mirror();
  const rev = shortId(12);
  const tx = database.transaction(["projects", "blobs", "versions", "sessions", "outbox"], "readwrite");
  await tx.objectStore("projects").delete(project.id);
  if (uid) await tx.objectStore("outbox").put({ id: project.id, rev, deleted: project });
  for (const slide of project.slides) {
    await tx.objectStore("blobs").delete(slide.imageKey);
    await tx.objectStore("blobs").delete(slide.thumbKey);
  }
  for (const key of await tx.objectStore("versions").index("projectId").getAllKeys(project.id)) await tx.objectStore("versions").delete(key);
  for (const key of await tx.objectStore("sessions").index("projectId").getAllKeys(project.id)) await tx.objectStore("sessions").delete(key);
  await tx.done;
  notify({ type: "project-deleted", id: project.id });
  if (uid) cloud.removeProject(uid, project, () => void settleOutbox(database, project.id, rev));
}

// ── Slide images ────────────────────────────────────────────────────────────

export async function putBlobs(entries: [string, Blob][]) {
  const tx = (await db()).transaction("blobs", "readwrite");
  for (const [key, blob] of entries) await tx.store.put(blob, key);
  await tx.done;
  const uid = mirror();
  if (uid) cloud.uploadBlobs(uid, entries);
}

/** Reads a slide image locally, fetching it from the account copy the first time on this device. */
export async function getBlob(key: string) {
  if (!key) return undefined;
  const database = await db();
  const local = await database.get("blobs", key);
  const uid = mirror();
  if (local || !uid) return local;
  const remote = await cloud.downloadBlob(uid, key);
  if (remote) await database.put("blobs", remote, key);
  return remote;
}

export async function deleteBlobs(keys: string[]) {
  const tx = (await db()).transaction("blobs", "readwrite");
  for (const key of keys) if (key) await tx.store.delete(key);
  await tx.done;
  const uid = mirror();
  if (uid) cloud.deleteBlobs(uid, keys);
}

// ── Script versions ─────────────────────────────────────────────────────────

export async function addVersion(version: ScriptVersion) {
  const database = await db();
  await database.put("versions", version);
  const uid = mirror();
  if (uid) cloud.saveVersion(uid, version);
  const all = (await database.getAllFromIndex("versions", "projectId", version.projectId)).sort((a, b) => b.createdAt - a.createdAt);
  for (const stale of all.slice(MAX_VERSIONS_PER_PROJECT)) {
    await database.delete("versions", stale.id);
    if (uid) cloud.deleteVersion(uid, stale.projectId, stale.id);
  }
}

export async function listVersions(projectId: string) {
  return (await (await db()).getAllFromIndex("versions", "projectId", projectId)).sort((a, b) => b.createdAt - a.createdAt);
}

// ── Presenter sessions ──────────────────────────────────────────────────────

/** Periodic checkpoints during a talk pass `sync: false`; the account gets the finished session. */
export async function putSession(session: PresenterSession, { sync = true } = {}) {
  await (await db()).put("sessions", session);
  const uid = sync ? mirror() : null;
  if (uid) cloud.saveSession(uid, session);
}

export async function getSession(id: string) {
  return (await db()).get("sessions", id);
}

export async function listSessions(projectId: string) {
  return (await (await db()).getAllFromIndex("sessions", "projectId", projectId)).sort((a, b) => b.startedAt - a.startedAt);
}

// ── Account copy ────────────────────────────────────────────────────────────

const newerCursor = (a: cloud.SyncCursor | null, b: cloud.SyncCursor | null) =>
  !a ? b : !b ? a : a.seconds > b.seconds || (a.seconds === b.seconds && a.nanoseconds >= b.nanoseconds) ? a : b;

/**
 * Reconciles this browser with the signed-in account's cloud copy: newer cloud projects (and their
 * versions and sessions) come down, projects deleted elsewhere are removed here, and local-only or
 * newer local projects go up. Slide images download lazily through getBlob. Returns whether local
 * data changed.
 *
 * After the first full listing, only project documents written since the last sync are read (a
 * single read when nothing changed). Local writes that never reached the account, because the tab
 * closed or the network dropped, wait in the outbox and are sent again here.
 */
export async function syncWithCloud() {
  const uid = mirror();
  if (!uid) return false;
  const database = await db();
  const meta = (await database.get("meta", "sync")) ?? { cursor: null, remote: [] };
  const { projects: remote, cursor } = await cloud.listRemoteProjects(uid, meta.cursor);
  if (uid !== mirror()) return false; // Signed out or switched accounts meanwhile.
  const local = new Map((await database.getAll("projects")).map((project) => [project.id, project]));
  const outbox = new Map((await database.getAll("outbox")).map((entry) => [entry.id, entry]));
  // A full listing is the whole truth; a delta only adds to what earlier syncs saw.
  const known = new Set(meta.cursor ? meta.remote : []);
  const upload = new Set<string>();
  let changed = false;

  for (const entry of remote) {
    known.add(entry.id);
    const mine = local.get(entry.id);
    if (entry.deleted) {
      if (!mine || mine.updatedAt > entry.updatedAt) continue;
      const tx = database.transaction(["projects", "blobs", "versions", "sessions", "outbox"], "readwrite");
      await tx.objectStore("projects").delete(mine.id);
      await tx.objectStore("outbox").delete(mine.id);
      for (const slide of mine.slides) for (const key of [slide.imageKey, slide.thumbKey]) if (key) await tx.objectStore("blobs").delete(key);
      for (const key of await tx.objectStore("versions").index("projectId").getAllKeys(mine.id)) await tx.objectStore("versions").delete(key);
      for (const key of await tx.objectStore("sessions").index("projectId").getAllKeys(mine.id)) await tx.objectStore("sessions").delete(key);
      await tx.done;
      local.delete(mine.id);
      outbox.delete(mine.id);
      changed = true;
    } else if (!mine || mine.updatedAt < entry.updatedAt) {
      const localVersions = mine ? await database.getAllFromIndex("versions", "projectId", mine.id) : [];
      const newestVersion = localVersions.length ? Math.max(...localVersions.map((version) => version.createdAt)) : null;
      const { versions, sessions } = await cloud.listRemoteChildren(uid, entry.id, newestVersion);
      const tx = database.transaction(["projects", "versions", "sessions", "outbox"], "readwrite");
      await tx.objectStore("projects").put(entry.project);
      await tx.objectStore("outbox").delete(entry.id);
      for (const version of versions) await tx.objectStore("versions").put(version);
      for (const session of sessions) await tx.objectStore("sessions").put(session);
      await tx.done;
      local.set(entry.id, entry.project);
      outbox.delete(entry.id);
      changed = true;
    } else if (mine.updatedAt > entry.updatedAt) {
      upload.add(mine.id);
    }
  }

  for (const project of local.values()) {
    // A write from this tab is already queued or on its way and settles its own outbox entry.
    if (cloud.isProjectBusy(project.id)) continue;
    const pending = outbox.get(project.id);
    const settle = pending ? () => void settleOutbox(database, project.id, pending.rev) : undefined;
    if (known.has(project.id)) {
      if (pending || upload.has(project.id)) cloud.saveProject(uid, project, settle);
      continue;
    }
    // The account has never had this project: back it up with its images and history.
    const blobs: [string, Blob][] = [];
    for (const slide of project.slides) {
      for (const key of [slide.imageKey, slide.thumbKey]) {
        const blob = key ? await database.get("blobs", key) : undefined;
        if (blob) blobs.push([key, blob]);
      }
    }
    const [versions, sessions] = await Promise.all([
      database.getAllFromIndex("versions", "projectId", project.id),
      database.getAllFromIndex("sessions", "projectId", project.id),
    ]);
    cloud.backfillProject(uid, project, blobs, versions, sessions, settle);
  }

  for (const entry of outbox.values()) {
    if (local.has(entry.id)) continue;
    if (entry.deleted) cloud.removeProject(uid, entry.deleted, () => void settleOutbox(database, entry.id, entry.rev));
    else await settleOutbox(database, entry.id, entry.rev); // The project is gone; nothing left to send.
  }

  // Another tab may have synced meanwhile; keep whichever cursor is further along.
  const tx = database.transaction("meta", "readwrite");
  const latest = meta.cursor ? (await tx.store.get("sync"))?.cursor ?? null : null;
  await tx.store.put({ cursor: newerCursor(cursor, latest), remote: [...known] }, "sync");
  await tx.done;
  return changed;
}
