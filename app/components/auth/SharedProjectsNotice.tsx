"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { moveSharedProjects, sharedProjectCount, syncWithCloud } from "@/lib/store/db";
import { useProjects } from "@/lib/store/projects";
import { Button } from "../ui/button";
import { Callout } from "../ui/controls";

/**
 * Presentations saved in this browser before sign-in stay in a shared local database until the
 * signed-in user explicitly moves them into their account.
 */
export function SharedProjectsNotice() {
  const { enabled, account } = useAuth();
  const { reload } = useProjects();
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !account) return;
    let active = true;
    sharedProjectCount().then((value) => { if (active) setCount(value); }).catch(() => {});
    return () => { active = false; };
  }, [enabled, account]);

  if (!count) return null;

  const move = async () => {
    setPending(true);
    setFailed(false);
    try {
      await moveSharedProjects();
      setCount(0);
      // Other tabs hear the change through the data channel; this one reloads and backs them up.
      await reload();
      if (await syncWithCloud().catch(() => false)) await reload();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="shell__alert">
      <Callout
        tone={failed ? "error" : "info"}
        title={`${count} ${count === 1 ? "presentation was" : "presentations were"} saved in this browser before sign-in`}
        action={<Button size="sm" loading={pending} onClick={move}>Move to my account</Button>}
      >
        {failed ? "They couldn't be moved. Try again." : "Only move them if they're yours. Anyone who signs in here next can move them otherwise."}
      </Callout>
    </div>
  );
}
