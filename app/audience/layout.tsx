import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "../components/auth/AuthGate";

/** The audience window reads slides from the presenter's own (per-account) local storage. */
export default function AudienceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
