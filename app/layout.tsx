import type { Metadata } from "next";
import { Azeret_Mono, Syne } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const azeretMono = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
});

const title = "Cueframe";
const description = "Slide-aware teleprompter.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: imageUrl, width: 1680, height: 941, alt: "Cueframe" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${azeretMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
