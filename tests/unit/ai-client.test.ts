import assert from "node:assert/strict";
import test from "node:test";

test("a rejected request is reported once and never automatically retried", async () => {
  const originalFetch = globalThis.fetch;
  // The browser storage module opens a tab channel on import; this test has no browser tabs.
  const globals = globalThis as { BroadcastChannel?: typeof BroadcastChannel };
  const originalChannel = globals.BroadcastChannel;
  delete globals.BroadcastChannel;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: "The AI couldn't process this content.", code: "rejected" }, { status: 422 });
  };
  try {
    const { aiFetch, AiRequestError } = await import("../../lib/ai/client");
    await assert.rejects(aiFetch("write", {}), (error: unknown) => {
      assert.ok(error instanceof AiRequestError);
      assert.equal(error.code, "rejected");
      return true;
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globals.BroadcastChannel = originalChannel;
  }
});
