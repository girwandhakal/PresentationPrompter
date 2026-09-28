"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import { authEnabled, firebaseConfig } from "./config";

export { authEnabled };

let services: { app: FirebaseApp; auth: Auth } | null = null;

/** Lazily initializes Firebase and Auth in the browser. Call only when `authEnabled` is true. */
export function firebase() {
  if (!services) {
    const existing = getApps().length > 0;
    const app = existing ? getApp() : initializeApp(firebaseConfig);
    if (!existing) startAppCheck(app);
    services = { app, auth: getAuth(app) };
  }
  return services;
}

/**
 * Firestore and Storage load on first use rather than with the page: sign-in needs only Auth, and
 * cloud sync starts after local data is already on screen. Together they are most of the SDK.
 */
let firestorePromise: Promise<Firestore> | null = null;
let storagePromise: Promise<FirebaseStorage> | null = null;

export function firestore() {
  firestorePromise ??= import("firebase/firestore").then(({ getFirestore }) => getFirestore(firebase().app));
  return firestorePromise;
}

/** Storage paths are users/{uid}/...; storage.rules allow only the owner. */
export function storage() {
  storagePromise ??= import("firebase/storage").then(({ getStorage }) => getStorage(firebase().app));
  return storagePromise;
}

/**
 * App Check attests that Auth, Firestore, and Storage requests come from this site (reCAPTCHA
 * Enterprise). It does nothing until NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set, and requests are only
 * rejected after enforcement is turned on in the Firebase console. On localhost it uses a debug
 * token, which the console must list before enforcement.
 */
function startAppCheck(app: FirebaseApp) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || typeof window === "undefined") return;
  if (location.hostname === "localhost") {
    (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
}
