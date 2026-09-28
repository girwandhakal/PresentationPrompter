import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

/**
 * Firestore and Storage Security Rules against the local emulators (npm run test:rules). The core
 * property: a signed-in user reaches only data under their own uid, and nobody reaches anything else.
 */
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cueframe",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

const alice = () => env.authenticatedContext("alice", { email: "alice@example.com" });
const bob = () => env.authenticatedContext("bob", { email: "bob@example.com" });
const profile = (email = "alice@example.com") => ({ displayName: "Alice", email, photoURL: "https://example.com/a.png", lastSignInAt: serverTimestamp() });

test("a user can write and read only their own profile", async () => {
  await assertSucceeds(setDoc(doc(alice().firestore(), "users/alice"), profile(), { merge: true }));
  await assertSucceeds(getDoc(doc(alice().firestore(), "users/alice")));
  await assertFails(getDoc(doc(bob().firestore(), "users/alice")));
  await assertFails(setDoc(doc(bob().firestore(), "users/alice"), profile("bob@example.com")));
});

test("signed-out visitors can't read or write profiles", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "users/alice")));
  await assertFails(setDoc(doc(anon, "users/alice"), profile()));
});

test("profiles can't be listed, deleted, or given extra or spoofed fields", async () => {
  const db = alice().firestore();
  await assertSucceeds(setDoc(doc(db, "users/alice"), profile()));
  await assertFails(getDocs(collection(db, "users")));
  await assertFails(deleteDoc(doc(db, "users/alice")));
  await assertFails(setDoc(doc(db, "users/alice"), { ...profile(), role: "admin" }));
  await assertFails(setDoc(doc(db, "users/alice"), profile("someone-else@example.com")));
  await assertFails(setDoc(doc(db, "users/alice"), { ...profile(), lastSignInAt: new Date(0) }));
  await assertFails(setDoc(doc(db, "users/alice"), { ...profile(), photoURL: "javascript:alert(1)" }));
});

const project = () => ({ json: JSON.stringify({ id: "p1", title: "Deck" }), updatedAt: 1, syncedAt: serverTimestamp() });

test("projects, versions, and sessions belong to their owner only", async () => {
  const mine = alice().firestore();
  const theirs = bob().firestore();
  await assertSucceeds(setDoc(doc(mine, "users/alice/projects/p1"), project()));
  await assertSucceeds(getDocs(collection(mine, "users/alice/projects")));
  const changed = await assertSucceeds(getDocs(query(collection(mine, "users/alice/projects"), where("syncedAt", ">", Timestamp.fromMillis(0)), orderBy("syncedAt"))));
  if (changed.size !== 1) throw new Error("the delta query should return the project written above");
  await assertSucceeds(setDoc(doc(mine, "users/alice/projects/p1/versions/v1"), { json: "{}", createdAt: 1 }));
  await assertSucceeds(setDoc(doc(mine, "users/alice/projects/p1/sessions/s1"), { json: "{}", createdAt: 1 }));
  await assertFails(getDoc(doc(theirs, "users/alice/projects/p1")));
  await assertFails(getDocs(collection(theirs, "users/alice/projects")));
  await assertFails(setDoc(doc(theirs, "users/alice/projects/p1"), project()));
  await assertFails(deleteDoc(doc(theirs, "users/alice/projects/p1")));
  await assertFails(getDocs(collection(theirs, "users/alice/projects/p1/versions")));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice/projects/p1")));
});

test("project records are shape- and size-checked", async () => {
  const db = alice().firestore();
  await assertSucceeds(setDoc(doc(db, "users/alice/projects/p1"), { deleted: true, updatedAt: 2, syncedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { ...project(), deleted: true }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { ...project(), owner: "bob" }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { ...project(), json: "x".repeat(1_000_001) }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { ...project(), updatedAt: "yesterday" }));
  // Delta sync depends on every write carrying the server's time, so it can't be omitted or backdated.
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { json: "{}", updatedAt: 1 }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1"), { ...project(), syncedAt: new Date(0) }));
  await assertFails(setDoc(doc(db, "users/alice/projects/p1/notes/n1"), { json: "{}", createdAt: 1 }));
});

test("server-owned data is closed to clients; usage is readable by its owner", async () => {
  await env.withSecurityRulesDisabled(async (admin) => {
    await setDoc(doc(admin.firestore(), "usage/2026-09-27/users/alice"), { tokens: 10 });
  });
  await assertSucceeds(getDoc(doc(alice().firestore(), "usage/2026-09-27/users/alice")));
  await assertFails(getDoc(doc(bob().firestore(), "usage/2026-09-27/users/alice")));
  await assertFails(setDoc(doc(alice().firestore(), "usage/2026-09-27/users/alice"), { tokens: 0 }));
  await assertFails(getDoc(doc(alice().firestore(), "usage/2026-09-27")));
  await assertFails(getDoc(doc(alice().firestore(), "config/limits")));
  await assertFails(setDoc(doc(alice().firestore(), "admission/accounts"), { used: 0, max: 1000 }));
  await assertFails(setDoc(doc(alice().firestore(), "jobs/j1"), { uid: "alice" }));
});

const pdf = () => new Uint8Array([0x25, 0x50, 0x44, 0x46]);

test("storage: slide images under users/{uid}/blobs follow the same ownership", async () => {
  const image = ref(alice().storage(), "users/alice/blobs/p1/s1/image");
  await assertSucceeds(uploadBytes(image, pdf(), { contentType: "image/webp" }));
  await assertFails(getBytes(ref(bob().storage(), "users/alice/blobs/p1/s1/image")));
});

test("storage: owners upload, read, and delete their own files only", async () => {
  const mine = ref(alice().storage(), "users/alice/decks/talk.pdf");
  await assertSucceeds(uploadBytes(mine, pdf(), { contentType: "application/pdf" }));
  await assertSucceeds(getBytes(mine));
  await assertFails(getBytes(ref(bob().storage(), "users/alice/decks/talk.pdf")));
  await assertFails(deleteObject(ref(bob().storage(), "users/alice/decks/talk.pdf")));
  await assertFails(uploadBytes(ref(bob().storage(), "users/alice/decks/evil.pdf"), pdf(), { contentType: "application/pdf" }));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), "users/alice/decks/talk.pdf")));
  await assertSucceeds(deleteObject(mine));
});

test("storage: rejects unsupported types, oversized files, and paths outside users/", async () => {
  const storage = alice().storage();
  await assertFails(uploadBytes(ref(storage, "users/alice/run.html"), pdf(), { contentType: "text/html" }));
  await assertFails(uploadBytes(ref(storage, "users/alice/big.pdf"), new Uint8Array(20 * 1024 * 1024 + 1), { contentType: "application/pdf" }));
  await assertFails(uploadBytes(ref(storage, "public/talk.pdf"), pdf(), { contentType: "application/pdf" }));
  await assertSucceeds(uploadBytes(ref(storage, "users/alice/slide-1.png"), pdf(), { contentType: "image/png" }));
});
