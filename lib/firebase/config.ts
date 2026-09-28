/**
 * The web config identifies the Firebase project; it is not a secret. Access control comes from
 * Firebase Authentication, Security Rules (`firestore.rules`), and the authorized-domain list.
 * Next.js inlines NEXT_PUBLIC_* values only when each is referenced by its full name.
 *
 * Kept free of SDK imports, so code that only needs to know whether sign-in is on (the local store,
 * the audience window) doesn't pull Firebase into its bundle.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Sign-in is skipped when Firebase isn't configured or is switched off (the e2e suite does this). */
export const authEnabled =
  process.env.NEXT_PUBLIC_AUTH_MODE !== "off"
  && Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
