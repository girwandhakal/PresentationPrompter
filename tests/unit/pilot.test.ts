import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_LIMITS } from "../../lib/ai/server/quota";
import { PILOT, PILOT_TERMS } from "../../lib/pilot";

test("the landing page's daily script limit is the one the server enforces", () => {
  assert.equal(DEFAULT_LIMITS.userDailyGenerations, PILOT.dailyScripts);
});

test("the landing page's account limit is the one the signup gate enforces", () => {
  // functions/ is its own package, so compare against its source rather than importing it.
  const source = readFileSync(new URL("../../functions/src/index.ts", import.meta.url), "utf8");
  const match = /const DEFAULT_MAX_ACCOUNTS = (\d+);/.exec(source);
  assert.ok(match, "DEFAULT_MAX_ACCOUNTS not found in functions/src/index.ts");
  assert.equal(Number(match[1]), PILOT.accounts);
});

test("the pilot terms state both limits", () => {
  assert.match(PILOT_TERMS, new RegExp(`${PILOT.accounts} accounts`));
  assert.match(PILOT_TERMS, new RegExp(`${PILOT.dailyScripts} scripts per account per day`));
});
