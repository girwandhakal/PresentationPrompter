import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import { ToastProvider } from "./components/ui/toast";
import "./globals.css";

const title = "Cueframe";
const description = "A private, slide-aware teleprompter. Bring the deck you already made, get a script that sounds like you, and present with notes only you can see.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: imageUrl, width: 1680, height: 941, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
    robots: { index: true, follow: false },
  };
}

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
        <link rel="preload" href="/fonts/instrument-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
