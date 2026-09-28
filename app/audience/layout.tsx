/**
 * The audience window reads slides from the presenter's own (per-account) local storage. It does
 * not sign in: it opens the database of the account signed in to this browser's workspace (see
 * rememberedStoreOwner), so it loads fast and without the Firebase SDK when the presenter opens it.
 */
export default function AudienceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
