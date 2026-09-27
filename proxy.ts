import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap checks in front of the API routes (Next.js 16 "proxy", formerly middleware). The routes
 * still verify the ID token themselves (lib/ai/server/auth.ts); this only turns away requests that
 * can never succeed: cross-site calls and AI calls without a bearer token.
 */
const authRequired =
  process.env.NEXT_PUBLIC_AUTH_MODE !== "off" && Boolean(process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

function deny(status: number, code: string, error: string) {
  return NextResponse.json({ code, error }, { status, headers: { "cache-control": "no-store" } });
}

function crossSite(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  if (crossSite(request)) return deny(403, "forbidden", "This request isn't allowed.");
  const { pathname } = request.nextUrl;
  if (authRequired && pathname !== "/api/ai/status" && !/^Bearer \S+$/.test(request.headers.get("authorization") ?? "")) {
    return deny(401, "unauthenticated", "Sign in to use AI features.");
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
