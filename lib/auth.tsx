"use client";

import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authEnabled, firebase } from "./firebase/client";
import { flushCloud } from "./store/cloud";
import { stableContext } from "./stable-context";

export type Account = { uid: string; name: string | null; email: string | null; photoUrl: string | null };

type AuthState = {
  /** False when sign-in is not configured; the workspace then runs local-only. */
  enabled: boolean;
  /** "loading" until Firebase restores (or fails to restore) the saved session. */
  status: "loading" | "signed-in" | "signed-out";
  account: Account | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = stableContext<AuthState | null>("auth", null);

const toAccount = (user: User): Account => ({ uid: user.uid, name: user.displayName, email: user.email, photoUrl: user.photoURL });

/** Keeps the signed-in user's profile document current. Owner-only per firestore.rules. */
async function saveProfile(user: User) {
  const { db } = firebase();
  await setDoc(
    doc(db, "users", user.uid),
    { displayName: user.displayName ?? null, email: user.email ?? null, photoURL: user.photoURL ?? null, lastSignInAt: serverTimestamp() },
    { merge: true },
  );
}

export function signInErrorMessage(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  // The admission function (functions/src/index.ts) rejects new accounts once the pilot is full;
  // Firebase reports that as an internal error carrying the function's status.
  if (code === "auth/internal-error" && /RESOURCE_EXHAUSTED|pilot is full/i.test((error as FirebaseError).message)) {
    return "Cueframe's pilot is full right now, so new accounts can't be created. If you already have an account, sign in with it.";
  }
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.";
    case "auth/unauthorized-domain":
      return "Sign-in isn't enabled for this web address yet.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    default:
      return "Sign-in didn't finish. Try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>(authEnabled ? "loading" : "signed-out");
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    return onAuthStateChanged(firebase().auth, (user) => {
      setAccount(user ? toAccount(user) : null);
      setStatus(user ? "signed-in" : "signed-out");
      // The profile is a convenience record; the workspace must not wait on or fail with it.
      if (user) saveProfile(user).catch(() => {});
    });
  }, []);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(firebase().auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    // Queued cloud writes need this account's credentials, so send them before signing out.
    await flushCloud();
    await firebaseSignOut(firebase().auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ enabled: authEnabled, status, account, signIn, signOut }),
    [status, account, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export type Usage = { tokens: number; generations: number };

/** Today's AI usage (UTC day) from the server-written ledger; null while loading or unavailable. */
export function useTodayUsage(uid: string | null) {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    if (!authEnabled || !uid) return;
    const day = new Date().toISOString().slice(0, 10);
    return onSnapshot(
      doc(firebase().db, "usage", day, "users", uid),
      (snapshot) => setUsage({ tokens: Number(snapshot.get("tokens") ?? 0), generations: Number(snapshot.get("generations") ?? 0) }),
      () => setUsage(null),
    );
  }, [uid]);
  return usage;
}
