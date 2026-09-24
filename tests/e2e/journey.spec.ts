import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import path from "node:path";

const SAMPLE = path.join(process.cwd(), "tests/fixtures/sample-deck.pdf");

/** The sidebar's empty state only renders once the app has hydrated and opened local storage. */
async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByText("Your presentations will appear here.")).toBeVisible();
}

async function importSample(page: Page) {
  await ready(page, "/");
  await expect(page.getByRole("heading", { name: "Bring the deck you already made." })).toBeVisible();
  await page.locator("input[type=file]").first().setInputFiles(SAMPLE);
  await page.waitForURL(/\/p\/[a-z0-9]+\/setup$/);
  return page.url().match(/\/p\/([a-z0-9]+)\//)![1];
}

test("import, brief, generate, edit, present, and review a deck", async ({ page, context }) => {
  const id = await importSample(page);

  // Setup: slides rendered from the PDF, analysis runs in the background and suggests a goal.
  await expect(page.getByText("6 slides from sample-deck.pdf")).toBeVisible();
  await expect(page.getByText(/Read 6 slides/)).toBeVisible();
  await expect(page.getByLabel("Goal")).not.toHaveValue("");
  await page.getByLabel("Audience").fill("Product and go-to-market leads");
  await expect(page.getByText(/8 min · 130 wpm/)).toBeVisible();

  await page.getByRole("button", { name: "Write my script" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/edit`));
  await expect(page.getByText("Your script is ready")).toBeVisible();

  // Editor: the script is editable and autosaves.
  const editor = page.getByRole("textbox", { name: "Script for slide 1" });
  await expect(editor).toContainText("Thanks for being here");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" One more line for the room.");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // A targeted AI rewrite is proposed, reviewed, and accepted.
  await page.getByRole("button", { name: "Improve" }).click();
  await page.getByRole("menuitem", { name: "More conversational" }).click();
  await expect(page.getByRole("region", { name: "Proposed change" })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Rewrite applied.")).toBeVisible();

  // Presenter with an audience window in another tab.
  await page.getByRole("link", { name: "Present", exact: true }).click();
  await page.waitForURL(new RegExp(`/p/${id}/present`));
  const audience = await context.newPage();
  await audience.goto(`/audience/${id}`);
  await expect(page.getByText("Audience window connected")).toBeVisible();
  await page.getByRole("button", { name: "Start presenting" }).click();

  await expect(audience.getByRole("img", { name: "A quieter way to launch" })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Slide 2 of 6")).toBeVisible();
  await expect(audience.getByRole("img", { name: "Clarity is already compounding" })).toBeVisible();

  // The audience window never receives script or cue text.
  const audienceText = await audience.locator("body").innerText();
  expect(audienceText).not.toContain("Pause and let the slide land");
  expect(audienceText).not.toContain("Now, clarity");

  // Blank the room's screen, recover, then end.
  await page.keyboard.press("b");
  await expect(audience.getByRole("img")).toHaveCount(0);
  await page.keyboard.press("b");
  await page.keyboard.press("r");
  await expect(page.getByRole("heading", { name: "You're on this slide" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End and review" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/review`));
  await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  await expect(audience.getByText("Thank you")).toBeVisible();
  await expect(page.getByText(/used “I lost my place” once/)).toBeVisible();

  // Work persists across a reload.
  await page.goto(`/p/${id}`);
  await expect(page.getByRole("heading", { name: "sample deck", level: 1 })).toBeVisible();
  // The accepted "More conversational" rewrite (which opens with "So,") was saved.
  await expect(page.getByLabel("Script for slide 1").getByText(/^So, thanks for being here/)).toBeVisible();
  await expect(page.getByLabel("Script for slide 1")).toContainText("One more line for the room.");
});

test("PowerPoint files import with titles and speaker notes", async ({ page }) => {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`);
  const slide = (title: string, bullets: string[]) => `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody>${bullets.map((bullet) => `<a:p><a:r><a:t>${bullet}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld><p:timing><p:tnLst><p:par/></p:tnLst></p:timing></p:sld>`;
  zip.file("ppt/slides/slide1.xml", slide("Quarterly review", ["Revenue grew in every region", "Churn is flat"]));
  zip.file("ppt/slides/slide2.xml", slide("Next steps", ["Hire two engineers"]));
  zip.file("ppt/slides/_rels/slide1.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`);
  zip.file("ppt/notesSlides/notesSlide1.xml", `<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Mention the APAC number first.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await ready(page, "/new");
  await page.locator("input[type=file]").first().setInputFiles({ name: "Quarterly review.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer });
  await page.waitForURL(/\/setup$/);
  await expect(page.getByText("2 slides from Quarterly review.pptx")).toBeVisible();
  await expect(page.getByText("Quarterly review", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/PowerPoint slides are shown as simplified previews/)).toBeVisible();
  await expect(page.getByText(/content that doesn't carry over/)).toBeVisible();

  // Speaker notes from the deck reach the editor's inspector.
  await page.getByRole("link", { name: "I'll write it myself" }).click();
  await expect(page.getByLabel("Speaker notes from the deck")).toHaveValue("Mention the APAC number first.");

  // Writing from scratch: text, a cue on its own line, and a new paragraph all persist.
  await page.getByRole("button", { name: "Write it myself" }).click();
  await page.keyboard.type("Revenue grew in every region.");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Point to the map");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Churn stayed flat.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("That is the headline.");
  await expect(page.getByText(/^12 words/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  const editor = page.getByRole("textbox", { name: "Script for slide 1" });
  await expect(editor).toContainText("Revenue grew in every region.");
  await expect(editor).toContainText("That is the headline.");
  await expect(editor.locator(".script-cue-chip")).toHaveText("Point to the map");
});

test("unsupported files get a clear, actionable message", async ({ page }) => {
  await ready(page, "/new");
  await page.locator("input[type=file]").first().setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("That file couldn't be imported")).toBeVisible();
  await expect(page.getByText(/isn't a supported file/)).toBeVisible();

  await page.locator("input[type=file]").first().setInputFiles({ name: "old.ppt", mimeType: "application/vnd.ms-powerpoint", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
  await expect(page.getByText(/Older .ppt files aren't supported/)).toBeVisible();
});

test("settings switch the theme and show demo AI status", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Demo mode")).toBeVisible();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Match system" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});
