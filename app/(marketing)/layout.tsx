import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "@/lib/auth";
import { PILOT_TERMS } from "@/lib/pilot";
import { LandingCta } from "../components/landing/LandingCta";
import { BrandMark } from "../components/shell/BrandMark";
import "../styles/marketing.css";

// The serif accent is for the public site only; the workspace keeps its single family.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={`mk ${serif.variable}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        <p className="pilot-bar">
          <Link href="/#access">
            Pilot now open, limited seats<span aria-hidden="true">*</span>
            <span className="pilot-bar__go" aria-hidden="true">→</span>
          </Link>
        </p>
        <header className="site-nav theme-dark">
          <div className="mk-wrap site-nav__inner">
            <Link href="/" className="site-nav__brand">
              <BrandMark size={26} />
              <span>Cueframe</span>
            </Link>
            <nav className="site-nav__links" aria-label="Page sections">
              <Link href="/#how">How it works</Link>
              <Link href="/#features">Features</Link>
              <Link href="/#access">Access</Link>
              <Link href="/#faq">FAQ</Link>
            </nav>
            <div className="site-nav__actions">
              <span className="site-nav__sign-in"><LandingCta place="sign-in" /></span>
              <LandingCta place="nav" />
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer theme-dark">
          <div className="mk-wrap site-footer__inner">
            <Link href="/" className="site-nav__brand">
              <BrandMark size={22} />
              <span>Cueframe</span>
            </Link>
            <nav className="site-footer__links" aria-label="Footer">
              <Link href="/privacy">Privacy</Link>
              <Link href="/home">Your presentations</Link>
            </nav>
            <p className="site-footer__terms">*{PILOT_TERMS}</p>
            <p className="site-footer__copy">© {new Date().getFullYear()} Cueframe</p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
