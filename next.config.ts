import type { NextConfig } from "next";

/**
 * Slide images are blob: URLs from IndexedDB, pdf.js runs its worker from our own assets, and the
 * browser talks to our /api/ai routes. The only third parties are Firebase Authentication (Google
 * sign-in loads apis.google.com and frames the auth domain), Firestore, Cloud Storage, and
 * App Check's reCAPTCHA. Inline scripts are required for React Server Components payloads and
 * the theme bootstrap.
 */
const FIREBASE_AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const FIREBASE_CONNECT = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://firebasestorage.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
].join(" ");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://apis.google.com https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' blob: data: ${FIREBASE_CONNECT}`,
  // The auth domain hosts Firebase's sign-in helper frame; www.google.com hosts reCAPTCHA (App Check).
  `frame-src https://www.google.com${FIREBASE_AUTH_DOMAIN ? ` https://${FIREBASE_AUTH_DOMAIN}` : ""}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A stray lockfile in a parent folder makes Next guess the wrong workspace root; pin it here.
  turbopack: { root: import.meta.dirname },
  async headers() {
    // The dev server injects its own eval-based modules and HMR client; enforce CSP on production builds.
    // HSTS only makes sense once served over HTTPS; browsers ignore it on http://localhost.
    const csp = process.env.NODE_ENV === "production"
      ? [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ]
      : [];
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS, ...csp] },
      // Font file names carry a content hash (rename the file when it changes), so browsers can
      // keep them for a year instead of revalidating on every visit.
      { source: "/fonts/:file", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
