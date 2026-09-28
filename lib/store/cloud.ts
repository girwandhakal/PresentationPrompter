"use client";

import type { Timestamp } from "firebase/firestore";
import type { PresenterSession, Project, ScriptVersion } from "../domain/types";
import { authEnabled } from "../firebase/config";

/**
 * The signed-in account's copy of every presentation, so it survives a cleared browser and follows
 * the user to other devices. IndexedDB (db.ts) stays the working copy; this mirrors its writes.
 *
 * Firestore  users/{uid}/projects/{id}                 { json, updatedAt, syncedAt } or { deleted, updatedAt, syncedAt }
 *            users/{uid}/projects/{id}/versions/{vid}  { json, createdAt }
 *            users/{uid}/projects/{id}/sessions/{sid}  { json, createdAt }
 * Storage    users/{uid}/blobs/{blob key}              slide images and thumbnails
 *
 * Records are stored as JSON strings: Firestore rejects nested arrays and undefined values, and
 * the app never queries inside them. Rules (firestore.rules, storage.rules) limit every path to
 * its owner. Conflicts resolve by `updatedAt`, last writer wins. `syncedAt` is the server's time of
 * each project write, so a device can ask for only what changed since its last sync.
 *
 * The Firestore and Storage SDKs are imported on first use, so pages that never reach the cloud
 * (the audience window) or haven't yet (first paint) don't load them.
 */

/** Firestore documents max out at 1 MiB; leave headroom for the other fields. */
const MAX_JSON = 1_000_000;
/** Project edits are mirrored once they pause this long... */
const PROJECT_IDLE_MS = 10_000;
/** ...and never held back longer than this while edits keep coming. */
const MAX_WAIT_MS = 60_000;
const SESSION_DEBOUNCE_MS = 5000;
/** Version timestamps come from device clocks; re-fetch a margin before the newest local one. */
const VERSION_CLOCK_MARGIN_MS = 60 * 60 * 1000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const cloudEnabled = () => authEnabled;

// ── Sync status (pending work and the last failure) ─────────────────────────

export type SyncState = { pending: number; error: string | null };
let state: SyncState = { pending: 0, error: null };
const listeners = new Set<(state: SyncState) => void>();

export function getSyncState() {
  return state;
}

export function subscribeSync(listener: (state: SyncState) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setState(next: SyncState) {
  state = next;
  for (const listener of listeners) listener(state);
}

/** Firebase errors carry a string `code`; checked by shape so this module needn't import the SDK. */
const errorCode = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
};

function describe(error: unknown) {
  if (error instanceof Error && error.message.startsWith("too-large")) return "A presentation is too large to save to your account. It's still saved in this browser.";
  if (errorCode(error).includes("unauthorized")) return "Your account didn't accept the change. Sign out and in, then try again.";
  return "Changes are saved in this browser but haven't reached your account yet.";
}

function track<T>(work: () => Promise<T>): Promise<T> {
  setState({ ...state, pending: state.pending + 1 });
  return work().then(
    (value) => { setState({ pending: state.pending - 1, error: null }); return value; },
    (error: unknown) => { setState({ pending: state.pending - 1, error: describe(error) }); throw error; },
  );
}

/** Background mirroring never fails the local save; failures surface through the sync state. */
function background(work: () => Promise<unknown>) {
  void track(work).catch(() => {});
}

// ── SDKs and paths ──────────────────────────────────────────────────────────

type FirestoreSdk = typeof import("firebase/firestore") & { db: import("firebase/firestore").Firestore };
type StorageSdk = typeof import("firebase/storage") & { bucket: import("firebase/storage").FirebaseStorage };
let firestoreSdk: Promise<FirestoreSdk> | null = null;
let storageSdk: Promise<StorageSdk> | null = null;

function fs() {
  firestoreSdk ??= Promise.all([import("firebase/firestore"), import("../firebase/client")])
    .then(async ([sdk, client]) => ({ ...sdk, db: await client.firestore() }))
    // A chunk that failed to load (offline) is retried by the next operation rather than cached.
    .catch((error: unknown) => { firestoreSdk = null; throw error; });
  return firestoreSdk;
}

function st() {
  storageSdk ??= Promise.all([import("firebase/storage"), import("../firebase/client")])
    .then(async ([sdk, client]) => ({ ...sdk, bucket: await client.storage() }))
    .catch((error: unknown) => { storageSdk = null; throw error; });
  return storageSdk;
}

const projectsRef = (f: FirestoreSdk, uid: string) => f.collection(f.db, "users", uid, "projects");
const projectRef = (f: FirestoreSdk, uid: string, id: string) => f.doc(f.db, "users", uid, "projects", id);
const childRef = (f: FirestoreSdk, uid: string, projectId: string, kind: "versions" | "sessions", id: string) =>
  f.doc(f.db, "users", uid, "projects", projectId, kind, id);
const childrenRef = (f: FirestoreSdk, uid: string, projectId: string, kind: "versions" | "sessions") =>
  f.collection(f.db, "users", uid, "projects", projectId, kind);
const blobRef = (s: StorageSdk, uid: string, key: string) => s.ref(s.bucket, `users/${uid}/blobs/${key}`);

function encode(value: unknown) {
  const json = JSON.stringify(value);
  if (json.length > MAX_JSON) throw new Error("too-large");
  return json;
}

/** The JSON of each project's last confirmed upload in this tab, so identical saves cost nothing. */
const lastSent = new Map<string, string>();

async function writeProject(uid: string, project: Project, { always = false } = {}) {
  const json = encode(project);
  const key = `${uid}/${project.id}`;
  if (!always && lastSent.get(key) === json) return;
  const f = await fs();
  await f.setDoc(projectRef(f, uid, project.id), { json, updatedAt: project.updatedAt, syncedAt: f.serverTimestamp() });
  lastSent.set(key, json);
}

// ── Debounced writes ────────────────────────────────────────────────────────

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => Promise<void>; since: number }>();
/** Writes that have left the debounce queue but not finished, by key. */
const inflight = new Map<string, Promise<void>>();

function send(key: string, run: () => Promise<void>) {
  const sending = track(run).finally(() => { if (inflight.get(key) === sending) inflight.delete(key); });
  inflight.set(key, sending);
  return sending;
}

function debounce(key: string, delay: number, run: () => Promise<void>) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing.timer);
  // A hidden page may be closing and its timers may never fire, so a save made now (often the
  // editor's final flush, which lands after the visibilitychange flush below) goes out at once.
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    timers.delete(key);
    void send(key, run).catch(() => {});
    return;
  }
  const since = existing?.since ?? Date.now();
  const timer = setTimeout(() => {
    timers.delete(key);
    void send(key, run).catch(() => {});
  }, Math.max(0, Math.min(delay, since + MAX_WAIT_MS - Date.now())));
  timers.set(key, { timer, run, since });
}

/** Sends queued writes now (before sign-out, or when the page is hidden). */
export async function flushCloud() {
  const pending = [...timers.entries()];
  timers.clear();
  for (const [, { timer }] of pending) clearTimeout(timer);
  await Promise.allSettled(pending.map(([key, { run }]) => send(key, run)));
}

/** Whether this tab still has a write for the project queued or on its way. */
export function isProjectBusy(id: string) {
  const key = `project:${id}`;
  return timers.has(key) || inflight.has(key);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushCloud(); });
}

// ── Mirroring local writes ──────────────────────────────────────────────────

/** `onSaved` runs once this copy (or a newer one queued after it) has reached the account. */
export function saveProject(uid: string, project: Project, onSaved?: () => void) {
  debounce(`project:${project.id}`, PROJECT_IDLE_MS, async () => {
    await writeProject(uid, project);
    onSaved?.();
  });
}

/** Leaves a tombstone so other devices remove their copy instead of re-uploading it. */
export function removeProject(uid: string, project: Project, onRemoved?: () => void) {
  const key = `project:${project.id}`;
  const queued = timers.get(key);
  if (queued) clearTimeout(queued.timer);
  timers.delete(key);
  lastSent.delete(`${uid}/${project.id}`);
  const sending = inflight.get(key);
  background(async () => {
    // A save already on its way could otherwise land after the tombstone and revive the project.
    await sending?.catch(() => {});
    const f = await fs();
    await f.setDoc(projectRef(f, uid, project.id), { deleted: true, updatedAt: Date.now(), syncedAt: f.serverTimestamp() });
    const children = await Promise.all((["versions", "sessions"] as const).map((kind) => f.getDocs(childrenRef(f, uid, project.id, kind))));
    await Promise.all(children.flatMap((snapshot) => snapshot.docs.map((entry) => f.deleteDoc(entry.ref))));
    await deleteStoredBlobs(uid, project.slides.flatMap((slide) => [slide.imageKey, slide.thumbKey]));
    onRemoved?.();
  });
}

export function uploadBlobs(uid: string, entries: [string, Blob][]) {
  background(() => uploadNow(uid, entries));
}

async function uploadNow(uid: string, entries: [string, Blob][]) {
  const s = await st();
  await Promise.all(entries.filter(([key]) => key).map(([key, blob]) =>
    s.uploadBytes(blobRef(s, uid, key), blob, { contentType: IMAGE_TYPES.has(blob.type) ? blob.type : "image/png" })));
}

export function deleteBlobs(uid: string, keys: string[]) {
  background(() => deleteStoredBlobs(uid, keys));
}

async function deleteStoredBlobs(uid: string, keys: string[]) {
  const s = await st();
  await Promise.all(keys.filter(Boolean).map((key) => s.deleteObject(blobRef(s, uid, key)).catch((error: unknown) => {
    if (errorCode(error) !== "storage/object-not-found") throw error;
  })));
}

export function saveVersion(uid: string, version: ScriptVersion) {
  background(async () => {
    const f = await fs();
    await f.setDoc(childRef(f, uid, version.projectId, "versions", version.id), { json: encode(version), createdAt: version.createdAt });
  });
}

export function deleteVersion(uid: string, projectId: string, id: string) {
  background(async () => {
    const f = await fs();
    await f.deleteDoc(childRef(f, uid, projectId, "versions", id));
  });
}

export function saveSession(uid: string, session: PresenterSession) {
  debounce(`session:${session.id}`, SESSION_DEBOUNCE_MS, async () => {
    const f = await fs();
    await f.setDoc(childRef(f, uid, session.projectId, "sessions", session.id), { json: encode(session), createdAt: session.startedAt });
  });
}

// ── Reading the account copy ────────────────────────────────────────────────

export type RemoteProject = { id: string; updatedAt: number } & ({ deleted: true } | { deleted?: false; project: Project });

/** Server time of the newest project write this device has seen, as stored in IndexedDB. */
export type SyncCursor = { seconds: number; nanoseconds: number };

/**
 * Project documents written after `since` (every document when it is null), plus the cursor to
 * pass next time. An unchanged account costs a single read instead of one per project.
 */
export function listRemoteProjects(uid: string, since: SyncCursor | null): Promise<{ projects: RemoteProject[]; cursor: SyncCursor | null }> {
  return track(async () => {
    const f = await fs();
    const snapshot = await f.getDocs(since
      ? f.query(projectsRef(f, uid), f.where("syncedAt", ">", new f.Timestamp(since.seconds, since.nanoseconds)), f.orderBy("syncedAt"))
      : projectsRef(f, uid));
    let cursor = since;
    const projects = snapshot.docs.map((entry): RemoteProject => {
      const data = entry.data() as { json?: string; updatedAt: number; deleted?: boolean; syncedAt?: Timestamp };
      // Documents written before syncedAt existed lack it; they are only seen by a full listing.
      const at = data.syncedAt;
      if (at instanceof f.Timestamp && (!cursor || at.seconds > cursor.seconds || (at.seconds === cursor.seconds && at.nanoseconds > cursor.nanoseconds))) {
        cursor = { seconds: at.seconds, nanoseconds: at.nanoseconds };
      }
      return data.deleted || !data.json
        ? { id: entry.id, updatedAt: data.updatedAt, deleted: true as const }
        : { id: entry.id, updatedAt: data.updatedAt, project: JSON.parse(data.json) as Project };
    });
    return { projects, cursor };
  });
}

/**
 * A project's versions and sessions. Versions never change once written, so with `versionsSince`
 * (the newest local version's time) only newer ones are read.
 */
export function listRemoteChildren(uid: string, projectId: string, versionsSince: number | null) {
  return track(async () => {
    const f = await fs();
    const versionsRef = childrenRef(f, uid, projectId, "versions");
    const [versions, sessions] = await Promise.all([
      f.getDocs(versionsSince == null ? versionsRef : f.query(versionsRef, f.where("createdAt", ">", versionsSince - VERSION_CLOCK_MARGIN_MS))),
      f.getDocs(childrenRef(f, uid, projectId, "sessions")),
    ]);
    return {
      versions: versions.docs.map((entry) => JSON.parse(entry.get("json")) as ScriptVersion),
      sessions: sessions.docs.map((entry) => JSON.parse(entry.get("json")) as PresenterSession),
    };
  });
}

/** Fetches one slide image from the account copy; undefined when it was never uploaded. */
export async function downloadBlob(uid: string, key: string) {
  const s = await st();
  try {
    return await s.getBlob(blobRef(s, uid, key));
  } catch (error) {
    if (errorCode(error) === "storage/object-not-found") return undefined;
    throw error;
  }
}

/** Uploads a project that exists only locally, with everything that belongs to it. */
export function backfillProject(uid: string, project: Project, blobs: [string, Blob][], versions: ScriptVersion[], sessions: PresenterSession[], onSaved?: () => void) {
  background(async () => {
    await uploadNow(uid, blobs);
    const f = await fs();
    await Promise.all([
      ...versions.map((version) => f.setDoc(childRef(f, uid, project.id, "versions", version.id), { json: encode(version), createdAt: version.createdAt })),
      ...sessions.map((session) => f.setDoc(childRef(f, uid, project.id, "sessions", session.id), { json: encode(session), createdAt: session.startedAt })),
    ]);
    // The project document last, so another device never sees it before its images exist.
    await writeProject(uid, project, { always: true });
    onSaved?.();
  });
}
