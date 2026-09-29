import type { Metadata, Viewport } from "next";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { MotionProvider } from "./components/ui/motion";
import { ToastProvider } from "./components/ui/toast";
import "./globals.css";

const title = "Cueframe";
const description = "A private, slide-aware teleprompter. Bring the deck you already made, get a script that sounds like you, and present with notes only you can see.";

/**
 * Absolute base for social-card URLs. Resolved at build time rather than from request headers, so
 * every page stays static and CDN-cached (reading headers() here made every route render per request).
 */
function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!configured) return new URL("http://localhost:3000");
  return new URL(/^https?:\/\//.test(configured) ? configured : `https://${configured}`);
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: title, template: `%s · ${title}` },
  description,
  applicationName: title,
  icons: { icon: "/favicon.svg" },
  openGraph: { title, description, type: "website", images: [{ url: "/og.png", width: 1680, height: 941, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fef6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="preload" href="/fonts/inter-latin.3100e775.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
