import assert from "node:assert/strict";
import test from "node:test";
import { matchSlides, similarity } from "../../lib/domain/match";
import { isAudienceMessage, isAudienceState } from "../../lib/sync/protocol";

const deck = (titles: string[]) => titles.map((title, index) => ({ id: `s${index}`, title, text: `${title} details about ${title.toLowerCase()}` }));

test("replacement slides are matched by content even when reordered", () => {
  const old = deck(["Opening", "Quarterly revenue growth", "Hiring plan", "Closing ask"]);
  const next = deck(["Opening", "Hiring plan", "Quarterly revenue growth", "New appendix", "Closing ask"]).map((slide) => ({ ...slide, id: `n-${slide.id}` }));
  const matches = matchSlides(old, next);
  assert.equal(matches[1].oldId, "s2");
  assert.equal(matches[2].oldId, "s1");
  assert.equal(matches[3].oldId, null, "a genuinely new slide starts fresh");
  assert.equal(matches[4].oldId, "s3");
  assert.ok(matches.every((match) => match.oldId === null || match.reason === "content"));
});

test("same-length decks fall back to position for slides without text", () => {
  const old = [{ id: "a", title: "", text: "" }, { id: "b", title: "", text: "" }];
  const next = [{ id: "x", title: "", text: "" }, { id: "y", title: "", text: "" }];
  const matches = matchSlides(old, next);
  assert.deepEqual(matches.map((match) => [match.oldId, match.reason]), [["a", "position"], ["b", "position"]]);
});

test("an old slide is never used twice", () => {
  const old = deck(["Revenue"]);
  const next = deck(["Revenue", "Revenue"]).map((slide, index) => ({ ...slide, id: `n${index}` }));
  const used = matchSlides(old, next).map((match) => match.oldId).filter(Boolean);
  assert.equal(used.length, 1);
  assert.ok(similarity(old[0], next[0]) >= 0.5);
});

test("audience messages are validated strictly", () => {
  const state = { v: 1, type: "state", seq: 5, session: "presenter", index: 2, total: 6, slideId: "abc", blank: false, ended: false };
  assert.equal(isAudienceState(state), true);
  assert.equal(isAudienceState({ ...state, v: 2 }), false);
  assert.equal(isAudienceState({ ...state, index: -1 }), false);
  assert.equal(isAudienceState({ ...state, script: "private" } as unknown), true, "extra fields are ignored, not trusted");
  assert.equal(isAudienceMessage({ v: 1, type: "command", window: "w1", command: "next" }), true);
  assert.equal(isAudienceMessage({ v: 1, type: "command", window: "w1", command: "delete" }), false);
  assert.equal(isAudienceMessage({ v: 1, type: "heartbeat" }), false);
});
