/** The audience window reads slides locally; see app/(app)/(shell)/p/[id]/layout.tsx. */
export function generateStaticParams() {
  return [];
}

export default function AudienceSlideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
