import assert from "node:assert/strict";
import { test } from "node:test";
import { spokenProblems } from "../../lib/ai/server/spoken-lint";

test("flags label-and-colon openers", () => {
  assert.ok(spokenProblems(["Keep: small PRs, peer review."]).length);
  assert.ok(spokenProblems(["Short version: the form failed."]).length);
  assert.ok(spokenProblems(["We did well. Fix: project fields fell behind."]).length);
});

test("flags clipped notes and ticket recitals", () => {
  assert.ok(spokenProblems(["Data done. UI done. Tests pass. CI green."]).length);
  assert.ok(spokenProblems(["The tickets were #42, #46, and #52 plus #5 overall."]).length);
});

test("accepts natural spoken sentences", () => {
  assert.deepEqual(spokenProblems(["So the goal was simple: get people through checkout faster. We cut the form down to the fields people actually need, and it came out about twenty percent quicker."]), []);
  assert.deepEqual(spokenProblems([]), []);
});
