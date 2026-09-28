"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInErrorMessage, useAuth } from "@/lib/auth";
import { GoogleMark } from "../auth/GoogleMark";
import { Button, ButtonLink } from "../ui/button";

/**
 * The landing page's one action. Signed-out visitors continue with Google and land in their
 * workspace; signed-in visitors (or local builds without sign-in) go straight there.
 */
export function LandingCta({ size = "lg", compact = false }: { size?: "md" | "lg"; compact?: boolean }) {
  const { enabled, status, signIn } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || status === "signed-in") {
    return (
      <ButtonLink href="/home" variant="primary" size={size} trailing={<ArrowRight aria-hidden="true" />}>
        {compact ? "Open Cueframe" : "Open your presentations"}
      </ButtonLink>
    );
  }

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn();
      router.push("/home");
    } catch (reason) {
      setError(signInErrorMessage(reason));
      setPending(false);
    }
  };

  return (
    <div className="landing-cta">
      <Button variant={compact ? "secondary" : "primary"} size={size} loading={pending} onClick={start} icon={compact ? undefined : <GoogleMark />}>
        {compact ? "Sign in" : "Continue with Google"}
      </Button>
      {error && <p className="landing-cta__error" role="alert">{error}</p>}
    </div>
  );
}
