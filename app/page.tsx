"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePresentations } from "./components/workspace/use-presentations";

export default function Home() {
  const router = useRouter();
  const { presentations, ready } = usePresentations();

  useEffect(() => {
    if (!ready) return;
    const target = presentations[0];
    router.replace(target ? `/p/${target.id}` : "/new");
  }, [ready, presentations, router]);

  return null;
}
