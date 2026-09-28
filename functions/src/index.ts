import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as v1 from "firebase-functions/v1";
import { setGlobalOptions } from "firebase-functions/v2";
import { beforeUserCreated, HttpsError } from "firebase-functions/v2/identity";

initializeApp();
setGlobalOptions({ region: "us-east1", maxInstances: 5 });

/**
 * Pilot admission (Docs/PRODUCT_OVERVIEW.md section 25.2). Firebase runs `admitAccount` before it
 * creates any user, including on a first Google sign-in, so a hidden button can't bypass the cap.
 * Returning users never trigger it, so they can sign in when the pilot is full.
 *
 * admission/accounts          { used, max, updatedAt }  - change `max` in the console to resize
 * admission/accounts/members/{uid} { createdAt }        - who holds a slot
 *
 * Firestore rules deny all client access to admission/; only these functions write it.
 */
const DEFAULT_MAX_ACCOUNTS = 10;
const PILOT_FULL_MESSAGE = "Cueframe's pilot is full right now.";

const db = () => getFirestore();
const slots = () => db().doc("admission/accounts");
const member = (uid: string) => slots().collection("members").doc(uid);

/** Users created before this function existed; they hold slots from the first run. */
async function existingUserIds() {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    ids.push(...page.users.map((user) => user.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return ids;
}

export const admitAccount = beforeUserCreated({ timeoutSeconds: 7 }, async (event) => {
  const uid = event.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "Sign-in didn't include an account.");
  const seed = (await slots().get()).exists ? null : await existingUserIds();

  await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(slots());
    const max = Number(snapshot.get("max") ?? DEFAULT_MAX_ACCOUNTS);
    let used = Number(snapshot.get("used") ?? 0);
    if (!snapshot.exists && seed) {
      for (const id of seed) tx.set(member(id), { createdAt: FieldValue.serverTimestamp(), seeded: true });
      used = seed.length;
    }
    // Only the account ID is logged; no email or profile data.
    if (used >= max) {
      console.info("[admission] rejected: pilot full", { used, max });
      throw new HttpsError("resource-exhausted", PILOT_FULL_MESSAGE);
    }
    tx.set(slots(), { used: used + 1, max, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(member(uid), { createdAt: FieldValue.serverTimestamp() });
  });
});

/** Frees the slot once an account is actually deleted. */
export const releaseAccount = v1.region("us-east1").auth.user().onDelete(async (user) => {
  await db().runTransaction(async (tx) => {
    const holder = await tx.get(member(user.uid));
    if (!holder.exists) return;
    tx.delete(member(user.uid));
    tx.set(slots(), { used: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
});
