"use client";

import { FirebaseError } from "firebase/app";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import type { PresenterSession, Project, ScriptVersion } from "../domain/types";
import { authEnabled, firebase } from "../firebase/client";

/**
 * The signed-in account's copy of every presentation, so it survives a cleared browser and follows
 * the user to other devices. IndexedDB (db.ts) stays the working copy; this mirrors its writes.
 *
 * Firestore  users/{uid}/projects/{id}                 { json, updatedAt } or { deleted, updatedAt }
 *            users/{uid}/projects/{id}/versions/{vid}  { json, createdAt }
 *            users/{uid}/projects/{id}/sessions/{sid}  { json, createdAt }
 * Storage    users/{uid}/blobs/{blob key}              slide images and thumbnails
 *
 * Records are stored as JSON strings: Firestore rejects nested arrays and undefined values, and
 * the app never queries inside them. Rules (firestore.rules, storage.rules) limit every path to
 * its owner. Conflicts resolve by `updatedAt`, last writer wins.
 */

/** Firestore documents max out at 1 MiB; leave headroom for the other fields. */
const MAX_JSON = 1_000_000;
const PROJECT_DEBOUNCE_MS = 1200;
const SESSION_DEBOUNCE_MS = 5000;
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

function describe(error: unknown) {
  if (error instanceof Error && error.message.startsWith("too-large")) return "A presentation is too large to save to your account. It's still saved in this browser.";
  if (error instanceof FirebaseError && error.code.includes("unauthorized")) return "Your account didn't accept the change. Sign out and in, then try again.";
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

// ── Paths ───────────────────────────────────────────────────────────────────

const projectRef = (uid: string, id: string) => doc(firebase().db, "users", uid, "projects", id);
const childRef = (uid: string, projectId: string, kind: "versions" | "sessions", id: string) =>
  doc(firebase().db, "users", uid, "projects", projectId, kind, id);
const blobRef = (uid: string, key: string) => ref(firebase().storage, `users/${uid}/blobs/${key}`);

function encode(value: unknown) {
  const json = JSON.stringify(value);
  if (json.length > MAX_JSON) throw new Error("too-large");
  return json;
}

// ── Debounced writes ────────────────────────────────────────────────────────

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => Promise<void> }>();

function debounce(key: string, delay: number, run: () => Promise<void>) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    timers.delete(key);
    background(run);
  }, delay);
  timers.set(key, { timer, run });
}

/** Sends queued writes now (before sign-out, or when the page is hidden). */
export async function flushCloud() {
  const pending = [...timers.values()];
  timers.clear();
  for (const { timer } of pending) clearTimeout(timer);
  await Promise.allSettled(pending.map(({ run }) => track(run)));
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushCloud(); });
}

// ── Mirroring local writes ──────────────────────────────────────────────────

export function saveProject(uid: string, project: Project) {
  debounce(`project:${project.id}`, PROJECT_DEBOUNCE_MS, async () => {
    await setDoc(projectRef(uid, project.id), { json: encode(project), updatedAt: project.updatedAt });
  });
}

/** Leaves a tombstone so other devices remove their copy instead of re-uploading it. */
export function removeProject(uid: string, project: Project) {
  timers.delete(`project:${project.id}`);
  background(async () => {
    await setDoc(projectRef(uid, project.id), { deleted: true, updatedAt: Date.now() });
    const children = await Promise.all((["versions", "sessions"] as const).map((kind) =>
      getDocs(collection(firebase().db, "users", uid, "projects", project.id, kind))));
    await Promise.all(children.flatMap((snapshot) => snapshot.docs.map((entry) => deleteDoc(entry.ref))));
    await deleteStoredBlobs(uid, project.slides.flatMap((slide) => [slide.imageKey, slide.thumbKey]));
  });
}

export function uploadBlobs(uid: string, entries: [string, Blob][]) {
  background(() => uploadNow(uid, entries));
}

async function uploadNow(uid: string, entries: [string, Blob][]) {
  await Promise.all(entries.filter(([key]) => key).map(([key, blob]) =>
    uploadBytes(blobRef(uid, key), blob, { contentType: IMAGE_TYPES.has(blob.type) ? blob.type : "image/png" })));
}

export function deleteBlobs(uid: string, keys: string[]) {
  background(() => deleteStoredBlobs(uid, keys));
}

async function deleteStoredBlobs(uid: string, keys: string[]) {
  await Promise.all(keys.filter(Boolean).map((key) => deleteObject(blobRef(uid, key)).catch((error: unknown) => {
    if (!(error instanceof FirebaseError && error.code === "storage/object-not-found")) throw error;
  })));
}

export function saveVersion(uid: string, version: ScriptVersion) {
  background(() => setDoc(childRef(uid, version.projectId, "versions", version.id), { json: encode(version), createdAt: version.createdAt }));
}

export function deleteVersion(uid: string, projectId: string, id: string) {
  background(() => deleteDoc(childRef(uid, projectId, "versions", id)));
}

export function saveSession(uid: string, session: PresenterSession) {
  debounce(`session:${session.id}`, SESSION_DEBOUNCE_MS, async () => {
    await setDoc(childRef(uid, session.projectId, "sessions", session.id), { json: encode(session), createdAt: session.startedAt });
  });
}

// ── Reading the account copy ────────────────────────────────────────────────

export type RemoteProject = { id: string; updatedAt: number } & ({ deleted: true } | { deleted?: false; project: Project });

export function listRemoteProjects(uid: string): Promise<RemoteProject[]> {
  return track(async () => {
    const snapshot = await getDocs(collection(firebase().db, "users", uid, "projects"));
    return snapshot.docs.map((entry) => {
      const data = entry.data() as { json?: string; updatedAt: number; deleted?: boolean };
      return data.deleted || !data.json
        ? { id: entry.id, updatedAt: data.updatedAt, deleted: true as const }
        : { id: entry.id, updatedAt: data.updatedAt, project: JSON.parse(data.json) as Project };
    });
  });
}

export function listRemoteChildren(uid: string, projectId: string) {
  return track(async () => {
    const [versions, sessions] = await Promise.all((["versions", "sessions"] as const).map((kind) =>
      getDocs(collection(firebase().db, "users", uid, "projects", projectId, kind))));
    return {
      versions: versions.docs.map((entry) => JSON.parse(entry.get("json")) as ScriptVersion),
      sessions: sessions.docs.map((entry) => JSON.parse(entry.get("json")) as PresenterSession),
    };
  });
}

/** Fetches one slide image from the account copy; undefined when it was never uploaded. */
export async function downloadBlob(uid: string, key: string) {
  try {
    return await getBlob(blobRef(uid, key));
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "storage/object-not-found") return undefined;
    throw error;
  }
}

/** Uploads a project that exists only locally, with everything that belongs to it. */
export function backfillProject(uid: string, project: Project, blobs: [string, Blob][], versions: ScriptVersion[], sessions: PresenterSession[]) {
  background(async () => {
    await uploadNow(uid, blobs);
    await Promise.all([
      ...versions.map((version) => setDoc(childRef(uid, project.id, "versions", version.id), { json: encode(version), createdAt: version.createdAt })),
      ...sessions.map((session) => setDoc(childRef(uid, project.id, "sessions", session.id), { json: encode(session), createdAt: session.startedAt })),
    ]);
    // The project document last, so another device never sees it before its images exist.
    await setDoc(projectRef(uid, project.id), { json: encode(project), updatedAt: project.updatedAt });
  });
}
