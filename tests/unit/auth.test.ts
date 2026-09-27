import assert from "node:assert/strict";
import { before, test } from "node:test";
import { NextRequest } from "next/server";

// Sign-in is enabled by configuring a project ID; both modules read it when they load.
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-cueframe";
process.env.AI_PROVIDER = "demo";
delete process.env.NEXT_PUBLIC_AUTH_MODE;
delete process.env.FIREBASE_SERVICE_ACCOUNT;

let write: (request: Request) => Promise<Response>;
let status: () => Response | Promise<Response>;
let proxy: (request: NextRequest) => Response;
let bearerToken: (request: Request) => string | null;

before(async () => {
  ({ POST: write } = await import("../../app/api/ai/write/route"));
  ({ GET: status } = await import("../../app/api/ai/status/route"));
  ({ proxy } = await import("../../proxy"));
  ({ bearerToken } = await import("../../lib/ai/server/auth"));
});

function aiRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ai/write", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({}),
  });
}

// A structurally valid JWT that no Google key signed; rejected before any network call.
const unsignedJwt = [
  Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: "attacker", aud: "demo-cueframe", iss: "https://securetoken.google.com/demo-cueframe" })).toString("base64url"),
  "",
].join(".");

test("AI routes reject requests without a sign-in token", async () => {
  const response = await write(aiRequest());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "unauthenticated");
});

test("AI routes reject malformed and unsigned tokens", async () => {
  for (const token of ["not-a-token-at-all-but-long-enough", unsignedJwt]) {
    const response = await write(aiRequest({ authorization: `Bearer ${token}` }));
    assert.equal(response.status, 401, token);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("status stays public so the app can tell whether AI is configured", async () => {
  assert.equal((await status()).status, 200);
});

test("bearerToken accepts only a single well-formed bearer credential", () => {
  const withHeader = (value: string) => new Request("http://localhost", { headers: { authorization: value } });
  assert.equal(bearerToken(withHeader("Bearer abc.def.ghi-jkl_mno.pqrstuvwxyz")), "abc.def.ghi-jkl_mno.pqrstuvwxyz");
  assert.equal(bearerToken(withHeader("Basic dXNlcjpwYXNzd29yZA==")), null);
  assert.equal(bearerToken(withHeader("Bearer short")), null);
  assert.equal(bearerToken(withHeader("Bearer a b")), null);
});

test("proxy blocks cross-site API calls and AI calls without a token", () => {
  const request = (path: string, headers: Record<string, string>) =>
    new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers });

  assert.equal(proxy(request("/api/ai/write", { origin: "https://evil.example", authorization: "Bearer x" })).status, 403);
  assert.equal(proxy(request("/api/ai/write", { "sec-fetch-site": "cross-site", authorization: "Bearer x" })).status, 403);
  assert.equal(proxy(request("/api/ai/write", { origin: "http://localhost:3000" })).status, 401);
  assert.equal(proxy(request("/api/ai/status", { "sec-fetch-site": "same-origin" })).status, 200);
  assert.equal(proxy(request("/api/ai/write", { origin: "http://localhost:3000", authorization: "Bearer token" })).status, 200);
});
