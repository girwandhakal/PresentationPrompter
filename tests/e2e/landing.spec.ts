import { expect, test } from "@playwright/test";

test("the landing page explains the product and leads into the workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Know what to say\s*on every slide\./);
  await expect(page.getByRole("heading", { name: "Two screens. Only one of them is yours." })).toBeVisible();

  // Real product recordings, each with a pause control.
  await expect(page.locator("video")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /^(Pause|Play) Recording: a six-slide PDF/ })).toBeAttached();

  // Questions open in place.
  await page.getByText("Can my audience see my script?").click();
  await expect(page.getByText("The audience window only receives slide images.")).toBeVisible();

  // With sign-in off (as in these tests) the call to action opens the workspace directly.
  await page.getByRole("main").getByRole("link", { name: "Open your presentations" }).first().click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Import your slides" })).toBeVisible();
});

test("the privacy summary is reachable from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy during the pilot" })).toBeVisible();
});
