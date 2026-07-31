import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.startsWith("127.")
    ? "http"
    : "https";
  const baseUrl = new URL(`${protocol}://${host}`);
  const shareImage = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "Cueframe — Present with clarity",
    description:
      "Turn any presentation into a natural, timed speaker script with private delivery cues.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Cueframe — Present with clarity",
      description:
        "AI-generated speaker scripts, delivery cues, and a private presenter view.",
      type: "website",
      images: [{ url: shareImage, width: 1733, height: 909, alt: "Cueframe presentation coach" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cueframe — Present with clarity",
      description:
        "AI-generated speaker scripts, delivery cues, and a private presenter view.",
      images: [shareImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
