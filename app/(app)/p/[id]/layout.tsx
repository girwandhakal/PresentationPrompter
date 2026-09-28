/** Presenter and print pages read the project locally; see app/(app)/(shell)/p/[id]/layout.tsx. */
export function generateStaticParams() {
  return [];
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
