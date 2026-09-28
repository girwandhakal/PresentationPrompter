import { expect, test } from "@playwright/test";
import path from "node:path";

test("generation hands off to the editor without flashing setup", async ({ page }) => {
  await page.goto("/new");
  await expect(page.locator('nav[aria-label="Your presentations"][data-ready]')).toBeAttached();
  await page.locator("input[type=file]").first().setInputFiles(path.join(process.cwd(), "tests/fixtures/sample-deck.pdf"));
  await page.waitForURL(/\/p\/[a-z0-9]+\/setup$/);
  await expect(page.getByRole("textbox", { name: "Goal" })).not.toHaveValue("");
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const state = () => document.querySelector(".generating") ? "writing" : document.querySelector(".editor") ? "editor" : document.querySelector(".setup") ? "setup" : "other";
    const note = () => { const s = state(); if (seen.at(-1) !== s) seen.push(s); };
    note();
    new MutationObserver(note).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("button", { name: "Write my script" }).click();
  await page.waitForURL(/\/edit$/);
  await expect(page.getByText("Your script is ready")).toBeVisible();
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  // Once the writing screen is up, the setup form must not reappear before the editor.
  expect(seen.slice(seen.indexOf("writing"))).toEqual(["writing", "editor"]);
});
