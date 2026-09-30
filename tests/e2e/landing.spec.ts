import { expect, test } from "@playwright/test";
import { PILOT, PILOT_TERMS } from "../../lib/pilot";

test("the landing page explains the product and leads into the workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Know what to say\s*on every slide\./);
  await expect(page.getByRole("heading", { name: "Two screens. Only one of them is yours." })).toBeVisible();

  // Real product recordings and the live teleprompter, each with a pause control.
  await expect(page.locator("video")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /^(Pause|Play) Recording: a six-slide PDF/ })).toBeAttached();
  await expect(page.getByRole("button", { name: /^(Pause|Play) the teleprompter example$/ })).toBeAttached();

  // Questions open in place.
  await page.getByText("Can my audience see my script?").click();
  await expect(page.getByText("The audience window only receives slide images.")).toBeVisible();

  // With sign-in off (as in these tests) the call to action opens the workspace directly.
  await page.getByRole("main").getByRole("link", { name: "Open your presentations" }).first().click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Import your slides" })).toBeVisible();
});

test("pilot access states its limits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Access" }).click();
  const access = page.getByRole("article", { name: "Pilot access" });
  await expect(access).toBeInViewport();
  await expect(access.getByText(`Up to ${PILOT.dailyScripts} scripts per day*`)).toBeVisible();
  await expect(access.getByText(`*${PILOT_TERMS}`)).toBeVisible();

  await page.getByText("What are the limits?").click();
  await expect(page.getByText(`Up to ${PILOT.dailyScripts} scripts per account per day, and ${PILOT.accounts} accounts in the pilot.`)).toBeVisible();
});

test("the privacy summary is reachable from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy during the pilot" })).toBeVisible();
});
