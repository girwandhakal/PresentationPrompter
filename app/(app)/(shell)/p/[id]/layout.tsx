/**
 * Project pages read everything from the browser's own storage, so their HTML is the same for every
 * id. An empty list builds each id's shell on first request and then serves it from cache instead of
 * rendering the route on every visit.
 */
export function generateStaticParams() {
  return [];
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
