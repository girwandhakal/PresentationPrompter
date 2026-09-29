import { expect, test } from "@playwright/test";
import path from "node:path";

test("importing the first deck goes straight to setup without showing the library", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Import your slides" })).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __libraryShown: boolean };
    w.__libraryShown = false;
    const check = () => { if (document.querySelector(".home-grid")) w.__libraryShown = true; };
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  });
  await page.locator("input[type=file]").first().setInputFiles(path.join(process.cwd(), "tests/fixtures/sample-deck.pdf"));
  await page.waitForURL(/\/p\/[a-z0-9]+\/setup$/);
  await expect(page.getByRole("textbox", { name: "Goal" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __libraryShown: boolean }).__libraryShown)).toBe(false);
});
