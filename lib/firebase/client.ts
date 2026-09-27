"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * The web config identifies the Firebase project; it is not a secret. Access control comes from
 * Firebase Authentication, Security Rules (`firestore.rules`), and the authorized-domain list.
 * Next.js inlines NEXT_PUBLIC_* values only when each is referenced by its full name.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Sign-in is skipped when Firebase isn't configured or is switched off (the e2e suite does this). */
export const authEnabled =
  process.env.NEXT_PUBLIC_AUTH_MODE !== "off" && Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let services: { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } | null = null;

/** Lazily initializes Firebase in the browser. Call only when `authEnabled` is true. */
export function firebase() {
  if (!services) {
    const existing = getApps().length > 0;
    const app = existing ? getApp() : initializeApp(config);
    if (!existing) startAppCheck(app);
    // Storage paths are users/{uid}/...; storage.rules allow only the owner.
    services = { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  }
  return services;
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
