import type { NextConfig } from "next";

/**
 * Everything the app needs is same-origin: slide images are blob: URLs from IndexedDB, pdf.js runs
 * its worker from our own assets, and the browser only talks to our /api/ai routes. Inline scripts
 * are required for React Server Components payloads and the theme bootstrap.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
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
  async headers() {
    // The dev server injects its own eval-based modules and HMR client; enforce CSP on production builds.
    const csp = process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }] : [];
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS, ...csp] }];
  },
};

export default nextConfig;
