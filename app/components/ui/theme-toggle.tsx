"use client";

import { useState, useSyncExternalStore } from "react";
import { usePref } from "@/lib/prefs";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * One button for light and dark: the sun eclipses into a moon. Until the presenter picks, it follows
 * the system setting; a click stores an explicit choice. Adapted from Adam Argyle's theme switch
 * (web.dev, "Building a theme switch component").
 */
export function ThemeToggle() {
  const [theme, setTheme] = usePref("theme");
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_QUERY).matches, () => false);
  const dark = theme === "system" ? systemDark : theme === "dark";
  // Only animate changes the presenter makes, not the state settling in after page load.
  const [animate, setAnimate] = useState(false);
  const next = dark ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      data-dark={dark || undefined}
      data-animate={animate || undefined}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        setAnimate(true);
        setTheme(next);
      }}
    >
      <svg className="sun-and-moon" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
        <mask className="moon" id="theme-toggle-moon">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <circle cx="24" cy="10" r="6" fill="black" />
        </mask>
        <circle className="sun" cx="12" cy="12" r="6" mask="url(#theme-toggle-moon)" fill="currentColor" />
        <g className="sun-beams" stroke="currentColor">
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </g>
      </svg>
    </button>
  );
}
