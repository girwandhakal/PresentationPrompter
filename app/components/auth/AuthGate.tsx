"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signInErrorMessage, useAuth } from "@/lib/auth";
import { releaseAllBlobUrls } from "@/lib/store/blob-url";
import { setStoreOwner } from "@/lib/store/db";
import { BrandMark } from "../shell/BrandMark";
import { Button } from "../ui/button";
import { Callout, Spinner } from "../ui/controls";
import { GoogleMark } from "./GoogleMark";

/**
 * Shows the workspace only to a signed-in user; passes through when sign-in isn't configured.
 * Local storage is pointed at the signed-in account before any child reads it.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { enabled, status, account } = useAuth();
  const [owner, setOwner] = useState<string | null>(null);
  const uid = enabled && status === "signed-in" ? account?.uid ?? null : null;
  if (uid !== owner) {
    // Switching accounts: drop the previous account's cached slide images and database handle.
    releaseAllBlobUrls();
    setStoreOwner(uid);
    setOwner(uid);
  }
  // A session that ended without an explicit sign-out (expired, revoked) also forgets the account.
  const signedOut = enabled && status === "signed-out";
  useEffect(() => { if (signedOut) setStoreOwner(null); }, [signedOut]);
  if (!enabled || status === "signed-in") return <>{children}</>;
  if (status === "loading") {
    return <main className="standalone standalone--center"><Spinner label="Checking your sign-in" size={22} /></main>;
  }
  return <SignIn />;
}

function SignIn() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn();
    } catch (reason) {
      setError(signInErrorMessage(reason));
      setPending(false);
    }
  };

  return (
    <main className="standalone">
      <BrandMark size={36} />
      <h1>Sign in to Cueframe</h1>
      <p>Your presentations and scripts stay private to your account.</p>
      {error && <Callout tone="error">{error}</Callout>}
      <Button variant="primary" size="lg" loading={pending} onClick={start} icon={<GoogleMark />}>
        Continue with Google
      </Button>
    </main>
  );
}
