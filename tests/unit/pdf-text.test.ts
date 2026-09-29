import assert from "node:assert/strict";
import { test } from "node:test";
import { guessTitle, itemsToText, type TextItem } from "../../lib/import/pdf-text";

const PAGE = 720;

/** One text run: x from the left, y up from the bottom, like pdf.js reports it. */
function run(str: string, y: number, height: number, hasEOL = true): TextItem {
  return { str, hasEOL, height, transform: [height, 0, 0, height, 88, y] };
}

test("text runs join into lines", () => {
  const items = [run("Revenue grew", 400, 24, false), run("in every region", 400, 24), run("Churn is flat", 360, 24)];
  assert.equal(itemsToText(items), "Revenue grew in every region\nChurn is flat");
});

test("the title is the largest text in the upper part of the page", () => {
  const items = [run("The problem", 640, 19), run("Our blocks run hotter than the city", 590, 64), run("Source: volunteer readings", 40, 15)];
  assert.equal(guessTitle(items, PAGE), "Our blocks run hotter than the city");
});

test("a title set low on a title slide beats a small header above it", () => {
  // This is how the sample deck's first slide is laid out: a small header, then the title lower down.
  const items = [run("Eastside neighborhood council", 660, 19), run("Cooler streets", 300, 112), run("A plan to plant 1,200 street trees", 240, 30)];
  assert.equal(guessTitle(items, PAGE), "Cooler streets");
});

test("a big number lower on the page does not replace the title", () => {
  const items = [run("A three-year commitment from the city", 590, 64), run("$180,000", 200, 120)];
  assert.equal(guessTitle(items, PAGE), "A three-year commitment from the city");
});

test("a title split across lines is joined", () => {
  const items = [run("A three-year commitment", 590, 48, false), run("from the city.", 540, 48)];
  assert.equal(guessTitle(items, PAGE), "A three-year commitment from the city.");
});

test("pages with no text have no title", () => {
  assert.equal(guessTitle([], PAGE), "");
  assert.equal(guessTitle([run("  ", 500, 24)], PAGE), "");
});
