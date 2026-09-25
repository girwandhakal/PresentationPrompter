import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { headers } from "next/headers";
import { PresentationsProvider } from "./components/workspace/use-presentations";
import "./globals.css";
import "./editor.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-cueframe",
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
    <html lang="en" className={bricolage.variable}>
      <body>
        <PresentationsProvider>{children}</PresentationsProvider>
      </body>
    </html>
  );
}
