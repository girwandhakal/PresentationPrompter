import Link from "next/link";
import { AuthProvider } from "@/lib/auth";
import { LandingCta } from "../components/landing/LandingCta";
import { BrandMark } from "../components/shell/BrandMark";
import "../styles/landing.css";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-header__brand" aria-label="Cueframe">
            <BrandMark size={26} />
            <span>Cueframe</span>
          </Link>
          <nav className="site-header__nav" aria-label="Page sections">
            <Link href="/#how">How it works</Link>
            <Link href="/#stage">Presenting</Link>
            <Link href="/#privacy">Privacy</Link>
            <Link href="/#questions">Questions</Link>
          </nav>
          <LandingCta size="md" compact />
        </div>
      </header>
      <main id="main" className="landing">{children}</main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <span className="site-footer__brand"><BrandMark size={20} /> Cueframe</span>
          <nav aria-label="Footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/home">Your presentations</Link>
          </nav>
          <span className="site-footer__note">A pilot, © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </AuthProvider>
  );
}
