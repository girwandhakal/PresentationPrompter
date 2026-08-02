import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the functional presentation workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cueframe<\/title>/i);
  assert.match(html, /Add presentation/i);
  assert.match(html, /Quiet launch strategy/i);
  assert.match(html, /Start presentation/i);
  assert.match(html, /Your Account/i);
  assert.doesNotMatch(html, /pricing|upgrade now|starter loading skeleton|needs review|private by default/i);
});

test("implements the modular palette-driven frontend", async () => {
  const [css, layout, app, flow, editor, presenter, workspace, sidebar] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace/PresentationApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace/NewPresentationFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace/ScriptEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/presenter/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace/PresentationWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/workspace/WorkspaceSidebar.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /--powder:\s*#fce4d8/i);
  assert.match(css, /--pitch:\s*#070600/i);
  assert.match(css, /--blue:\s*#279af1/i);
  assert.match(layout, /Bricolage_Grotesque/);
  assert.doesNotMatch(layout, /Azeret_Mono|Syne/);
  assert.match(css, /--font-sans: var\(--font-cueframe\);/);
  assert.match(css, /--font-mono: var\(--font-cueframe\);/);
  assert.doesNotMatch(css, /font-syne|font-azeret/);
  assert.match(css, /\.glass-panel \{ background: color-mix\(in srgb, white 68%, var\(--powder\)\); border: 1px solid transparent; box-shadow: none;/);
  assert.match(css, /\.glass-panel--deep \{ background: color-mix\(in srgb, white 78%, var\(--powder\)\); box-shadow: none;/);
  assert.match(css, /backdrop-filter:\s*blur/i);
  assert.match(css, /html \{ height: 100%; overflow: hidden;/);
  assert.match(css, /\.app-main \{[^}]*overflow: hidden;/);
  assert.match(css, /\.create-workspace \{[^}]*height: 100%;/);
  assert.match(css, /\.app-shell \{[^}]*background: var\(--powder\);/);
  assert.doesNotMatch(css, /\.ambient--one|\.ambient--two|\.ambient--three/);
  assert.match(css, /\.presentation-row\.is-active \{[^}]*box-shadow: none;/);
  assert.match(css, /\.workspace-sidebar \{[^}]*box-shadow: none;/);
  assert.match(app, /WorkspaceSidebar/);
  assert.match(flow, /<h2>Upload<\/h2>/);
  assert.match(flow, /<h2>Details<\/h2>/);
  assert.match(flow, /> Generate/);
  assert.doesNotMatch(flow, /Upload slides|Edit the essentials|Generate teleprompter script/);
  assert.doesNotMatch(editor, /Teleprompter editor|Focused AI edits|Reading width/);
  assert.match(editor, /live-dot/);
  assert.match(editor, /openPreviewFullscreen/);
  assert.match(editor, /requestFullscreen/);
  assert.match(presenter, /BroadcastChannel/);
  assert.match(presenter, /Open audience window/);
  assert.match(workspace, /slide-navigation__control/);
  assert.match(workspace, /aria-label="Previous slide"/);
  assert.match(workspace, /aria-label="Next slide"/);
  assert.doesNotMatch(workspace, /preview-toolbar|Expand preview|Maximize2/);
  assert.match(workspace, /onDoubleClick={beginTitleEdit}/);
  assert.match(workspace, /project-title-input/);
  assert.match(workspace, /size={Math\.max\(12, titleDraft\.length \+ 1\)}/);
  assert.doesNotMatch(workspace, /Renaming|title-edit-status/);
  assert.match(workspace, /event\.currentTarget\.select\(\)/);
  assert.doesNotMatch(css, /\.project-title-input \{[^}]*border-bottom/);
  assert.match(css, /\.project-heading\.is-editing { width: fit-content; max-width: calc\(100% - 152px\); text-align: center;/);
  assert.doesNotMatch(css, /\.project-heading\.is-editing { position: absolute;/);
  assert.match(css, /\.project-title-input {[^}]*text-align: center;/);
  assert.match(css, /\.project-title-input {[^}]*font-weight: 400;/);
  assert.match(css, /\.project-title-input {[^}]*width: auto; max-width: 100%;/);
  assert.match(app, /editingTitleId/);
  assert.doesNotMatch(app, /renameId|renameValue|Rename presentation/);
  assert.match(sidebar, /placeholder="Search"/);
  assert.match(sidebar, /aria-label="Add presentation"/);
  assert.match(sidebar, /onToggleCollapse/);
  assert.match(app, /sidebarCollapsed/);
  assert.match(css, /\.workspace-sidebar\.is-collapsed/);
  assert.match(css, /\.workspace-sidebar\.is-collapsed \.brand-lockup \{ justify-content: center; gap: 0;/);
  assert.match(css, /\.workspace-sidebar\.is-collapsed \.sidebar-toggle \{ width: 47px; height: 47px; flex: 0 0 47px;/);
  assert.match(css, /\.workspace-sidebar\.is-collapsed \.presentation-row \{ width: 46px; min-height: 46px; margin-inline: auto;/);
  assert.match(css, /\.workspace-sidebar\.is-collapsed \.presentation-row__main \{ width: 100%; height: 44px; flex: 1 1 0; justify-content: center;/);
  assert.doesNotMatch(sidebar, /Your presentations|Search your work|presentation copilot/);
  assert.doesNotMatch(sidebar, /onRename|FilePenLine|> Rename</);
  assert.match(editor, /aria-label="Insert pause"/);
});
