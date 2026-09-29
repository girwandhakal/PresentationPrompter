import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone">
      <p className="eyebrow">404</p>
      <h1>This page doesn&apos;t exist</h1>
      <p>The link may be old, or the presentation was created in another browser.</p>
      <Link className="btn btn--primary btn--md" href="/home">Go to your presentations</Link>
    </main>
  );
}
