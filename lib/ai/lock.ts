/** Web Lock names held while AI work runs for a project (see holdLock in the orchestrator). */
export function aiLockName(kind: "analyze" | "generate", projectId: string) {
  return `cueframe:${kind}:${projectId}`;
}
