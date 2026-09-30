"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInErrorMessage, useAuth } from "@/lib/auth";
import { GoogleMark } from "../auth/GoogleMark";
import { Button, ButtonLink } from "../ui/button";
import { useToast } from "../ui/toast";

type Place = "main" | "nav" | "sign-in";

/**
 * The landing page's one action. Signed-out visitors join the pilot with Google (the same sign-in
 * returning users take) and land in their workspace; signed-in visitors, or local builds without
 * sign-in, go straight there. `main` reports failures beside the button; the header's compact
 * buttons have no room for that, so they report through a toast.
 */
export function LandingCta({ place = "main" }: { place?: Place }) {
  const { enabled, status, signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || status === "signed-in") {
    if (place === "sign-in") return null;
    return (
      <ButtonLink href="/home" variant="primary" size={place === "main" ? "lg" : "md"} trailing={<ArrowRight aria-hidden="true" />}>
        {place === "main" ? "Open your presentations" : "Open Cueframe"}
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
      const message = signInErrorMessage(reason);
      if (place === "main") setError(message);
      else if (message) toast({ message, tone: "error" });
      setPending(false);
    }
  };

  if (place === "sign-in") {
    return <Button variant="ghost" size="md" loading={pending} onClick={start}>Sign in</Button>;
  }
  if (place === "nav") {
    return <Button variant="primary" size="md" loading={pending} onClick={start}>Join the pilot</Button>;
  }
  return (
    <div className="landing-cta">
      <Button variant="primary" size="lg" loading={pending} onClick={start} icon={<GoogleMark />}>
        Join the free pilot
      </Button>
      {error && <p className="landing-cta__error" role="alert">{error}</p>}
    </div>
  );
}
