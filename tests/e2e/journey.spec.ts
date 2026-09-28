import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import path from "node:path";

const SAMPLE = path.join(process.cwd(), "tests/fixtures/sample-deck.pdf");

/** The sidebar list is marked ready once the app has hydrated and opened local storage. */
async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('nav[aria-label="Your presentations"][data-ready]')).toBeAttached();
}

async function importSample(page: Page) {
  await ready(page, "/home");
  await expect(page.getByRole("heading", { name: "Import your slides" })).toBeVisible();
  await page.locator("input[type=file]").first().setInputFiles(SAMPLE);
  await page.waitForURL(/\/p\/[a-z0-9]+\/setup$/);
  return page.url().match(/\/p\/([a-z0-9]+)\//)![1];
}

test("import, brief, generate, edit, present, and review a deck", async ({ page, context }) => {
  const id = await importSample(page);

  // Setup: slides rendered from the PDF, analysis runs in the background and suggests a goal.
  await expect(page.getByText("6 Slides", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Goal" })).not.toHaveValue("");
  await page.getByRole("textbox", { name: "Audience" }).fill("Product and go-to-market leads");
  await expect(page.locator(".length__value")).toHaveText(/8\s*min/);

  await page.getByRole("button", { name: "Write my script" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/edit`));
  await expect(page.getByText("Your script is ready")).toBeVisible();

  // Editor: the script is editable and autosaves.
  const editor = page.getByRole("textbox", { name: "Script for slide 1" });
  await expect(editor).toContainText("Hello, everyone.");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" One more line for the room.");
  await expect(page.locator('.editor[data-save-state="saved"]')).toBeAttached();

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
  // Presenting starts on its own, with no dialog in front of the teleprompter.
  await expect(page.getByRole("button", { name: /Audience window connected/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(audience.getByRole("img", { name: "A quieter way to launch" })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Slide 2 of 6")).toBeVisible();
  await expect(audience.getByRole("img", { name: "Clarity is already compounding" })).toBeVisible();

  // The audience window never receives script or cue text.
  const audienceText = await audience.locator("body").innerText();
  expect(audienceText).not.toContain("Pause and let the slide land");
  expect(audienceText).not.toContain("Now, clarity");

  // Blank the room's screen, then end.
  await page.keyboard.press("b");
  await expect(audience.getByRole("img")).toHaveCount(0);
  await page.keyboard.press("b");
  // The review lists sessions of at least a second (shorter ones round to zero and are hidden),
  // and this run can otherwise finish in about half a second.
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End and review" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/review`));
  await expect(page.getByRole("heading", { name: "Session review" })).toBeVisible();
  await expect(audience.getByText("Thank you")).toBeVisible();

  // Work persists across a reload.
  await page.goto(`/p/${id}`);
  // The title suggested from the slides replaced the file name automatically.
  await expect(page.getByRole("heading", { name: "A quieter way to launch", level: 1 })).toBeVisible();
  // The accepted "More conversational" rewrite (which opens with "So,") was saved.
  await expect(page.getByLabel("Script for slide 1").getByText(/^So, hello, everyone/).filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("Script for slide 1")).toContainText("One more line for the room.");
});

test("typing is kept when switching slides or leaving the editor right away", async ({ page }) => {
  const id = await importSample(page);
  await page.getByRole("button", { name: "Write my script" }).click();
  await page.waitForURL(new RegExp(`/p/${id}/edit`));
  const first = page.getByRole("textbox", { name: "Script for slide 1" });
  await expect(first).toContainText("Hello, everyone.");

  // Edits reach the page in batches; switching slides mid-batch must not drop or misplace them.
  await first.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Typed just before switching.");
  await page.keyboard.press("Alt+ArrowDown");
  const second = page.getByRole("textbox", { name: "Script for slide 2" });
  await expect(second).toBeVisible();
  await expect(second).not.toContainText("Typed just before switching.");
  await second.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Typed just before presenting.");
  await page.getByRole("link", { name: "Present", exact: true }).click();
  await page.waitForURL(new RegExp(`/p/${id}/present`));

  await page.goto(`/p/${id}/edit`);
  await expect(page.getByRole("textbox", { name: "Script for slide 1" })).toContainText("Typed just before switching.");
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByRole("textbox", { name: "Script for slide 2" })).toContainText("Typed just before presenting.");
});

test("PowerPoint files import with titles and speaker notes", async ({ page }) => {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/></Relationships>`);
  const slide = (title: string, bullets: string[]) => `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody>${bullets.map((bullet) => `<a:p><a:r><a:t>${bullet}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld><p:timing><p:tnLst><p:par/></p:tnLst></p:timing></p:sld>`;
  zip.file("ppt/slides/slide1.xml", slide("Quarterly review", ["Revenue grew in every region", "Churn is flat"]));
  zip.file("ppt/slides/slide2.xml", slide("Next steps", ["Hire two engineers"]));
  // Hidden in PowerPoint: must not be imported.
  zip.file("ppt/slides/slide3.xml", slide("Backup appendix", ["Raw data"]).replace("<p:sld ", '<p:sld show="0" '));
  zip.file("ppt/slides/_rels/slide1.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`);
  zip.file("ppt/notesSlides/notesSlide1.xml", `<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Mention the APAC number first.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await ready(page, "/new");
  await page.locator("input[type=file]").first().setInputFiles({ name: "Quarterly review.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer });
  await page.waitForURL(/\/setup$/);
  await expect(page.getByText("2 Slides", { exact: true })).toBeVisible();
  await expect(page.getByText("Quarterly review", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/PowerPoint slides are shown as simplified previews/)).toBeVisible();
  await expect(page.getByText(/content that doesn't carry over/)).toBeVisible();

  await page.getByRole("link", { name: "I'll write it myself" }).click();

  // Writing from scratch: text, a cue on its own line, and a new paragraph all persist.
  await page.getByRole("button", { name: "Write it myself" }).click();
  await page.keyboard.type("Revenue grew in every region.");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Point to the map");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Churn stayed flat.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("That is the headline.");
  await expect(page.getByRole("textbox", { name: "Script for slide 1" })).toContainText("That is the headline.");
  await expect(page.locator('.editor[data-save-state="saved"]')).toBeAttached();
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

test("the theme toggle switches light and dark, and remembers the choice", async ({ page }) => {
  await ready(page, "/settings");
  // Follows the system (light in tests) until the presenter picks.
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
