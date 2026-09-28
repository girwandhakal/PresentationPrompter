import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Server-side identity for the AI routes. Every request must carry the signed-in user's Firebase ID
 * token as `Authorization: Bearer <token>`; the Admin SDK checks its signature, issuer, audience
 * (this project), and expiry against Google's public keys. With a service-account credential
 * (FIREBASE_SERVICE_ACCOUNT, JSON), it also rejects tokens revoked by sign-out-everywhere or account
 * suspension. The user ID comes only from the verified token, never from the request body.
 */

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** Mirrors the client switch: sign-in is required whenever Firebase is configured and not turned off. */
export const serverAuthEnabled = process.env.NEXT_PUBLIC_AUTH_MODE !== "off" && Boolean(projectId);

let app: App | null = null;
let checkRevoked = false;

/** A service account lets the server also write Firestore (quotas) and check revocation. */
export const hasAdminCredentials = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

export function adminApp() {
  if (app) return app;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  checkRevoked = Boolean(serviceAccount);
  const existing = getApps()[0];
  if (existing) return (app = existing);
  app = initializeApp(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)), projectId } : { projectId });
  return app;
}

export type Caller = { uid: string };

export type AuthFailure = { status: 401 | 403; code: string; error: string };

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header);
  return match?.[1] ?? null;
}

export async function authenticate(request: Request): Promise<Caller | AuthFailure> {
  const token = bearerToken(request);
  if (!token) return { status: 401, code: "unauthenticated", error: "Sign in to use AI features." };
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token, checkRevoked);
    return { uid: decoded.uid };
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (code === "auth/id-token-revoked" || code === "auth/user-disabled") {
      return { status: 403, code: "session_revoked", error: "This session has ended. Sign in again." };
    }
    // Expired, malformed, or foreign-project tokens: never log the token itself.
    return { status: 401, code: "unauthenticated", error: "Your sign-in expired. Sign in again." };
  }
}
