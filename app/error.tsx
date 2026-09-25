"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[cueframe] unexpected error", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="standalone">
      <p className="eyebrow">Something went wrong</p>
      <h1>This screen couldn&apos;t load</h1>
      <p>Your presentations are saved in this browser and weren&apos;t affected. Try again, or go back to your presentations.</p>
      <div className="standalone__actions">
        <button type="button" className="btn btn--primary btn--md" onClick={reset}>Try again</button>
        <Link className="btn btn--secondary btn--md" href="/">Your presentations</Link>
      </div>
    </main>
  );
}
