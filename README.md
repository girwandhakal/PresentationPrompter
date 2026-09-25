# Cueframe

A private, slide-aware teleprompter. Bring the deck you already made, get a script that sounds like
you, and present with notes only you can see while the audience sees only your slides.

**The loop:** import slides → describe your talk → AI writes a timed script → edit it in a
teleprompter-specific editor → present with a synchronized audience window → review your timing.

## Quick start

```bash
npm install
cp .env.example .env.local   # then add your OpenAI key
npm run dev                  # http://localhost:3000
```

No key yet? Run `npm run dev:demo` to use the built-in **demo AI**. It builds scripts from your
slide text, so you can try every screen without a key or network access. The app labels this
mode everywhere it applies.

Requires Node.js 22.13 or newer.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For AI writing | Server-side key for the OpenAI Responses API. Never sent to the browser. |
| `OPENAI_MODEL` | No | Model used for analysis and writing (default `gpt-5.6-sol`). Must support structured outputs and image input. |
| `OPENAI_BASE_URL` | No | Point at an OpenAI-compatible proxy or gateway. |
| `AI_PROVIDER` | No | `demo` forces the keyless demo provider (development and tests). |

With no key and no `AI_PROVIDER`, a production build shows a calm "AI isn't set up" state. People
can still import, write scripts by hand, and present.

## How it works

```text
Browser (everything the user creates lives here)
 ├─ Import: pdf.js renders PDFs; PPTX is parsed from OOXML; images are normalized
 ├─ IndexedDB: projects, slide images (Blobs), script versions, presenter sessions
 ├─ Orchestrator: analyze → deck context → plan (local) → outline → write, in bounded batches
 ├─ Editor (Lexical), Presenter, Review
 └─ Audience window ◀── BroadcastChannel (slide index, blank, ended — never script text)
                │
                ▼  /api/ai/*  (Cloudflare Worker via vinext)
AI gateway: schema-validated requests → OpenAI structured outputs → validation & repair
```

- **Local-first.** Decks, scripts and history are stored in the browser's IndexedDB, and all storage
  goes through [`lib/store/db.ts`](lib/store/db.ts) so a sync backend can be added later. Settings has
  backup/restore (`.cueframe` files) and delete-everything.
- **AI pipeline.** [`lib/ai/orchestrator.tsx`](lib/ai/orchestrator.tsx):
  - Analysis starts as soon as slides are imported. It reads each slide's image and text and
    prefills the setup form with suggestions.
  - Generation plans a word budget per slide ([`lib/domain/planner.ts`](lib/domain/planner.ts)),
    outlines the narrative arc, then writes slides in parallel batches.
  - Every response is validated ([`lib/ai/validate.ts`](lib/ai/validate.ts)): cue anchors, figures
    that aren't in the source (flagged, never removed), and word budget (one automatic repair pass).
  - A draft is saved only when every slide came back valid, and earlier versions are kept in History.
- **Rewrites.** Actions work on a slide or on selected text (shorten, simplify, clearer transition,
  add example, and so on). They always show a proposal to accept or discard, and never overwrite
  silently.
- **Presenter.**
  - Scrolling speed comes from your words per minute, with a reading line at eye level.
  - Auto-advance uses a countdown you can cancel. Reading modes are full script, short, keywords
    and cues only.
  - Per-slide timers, marks for review, blanking the audience screen, and a keep-awake lock.
  - Clicker keys work in both windows.
- **Privacy.** The audience window loads only slide images. Scripts and cues never cross the sync
  channel, and an end-to-end test checks this. AI requests contain slide images, slide text and the
  brief, only when the user asks for a script or rewrite. The server doesn't log content.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:demo` | Development server (real AI / demo AI) |
| `npm run build` | Production build (Cloudflare Worker + static assets) |
| `npm run preview` | Serve the production build locally in workerd, including security headers |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit and API integration tests (demo provider, no network) |
| `npm run test:e2e` | Playwright end-to-end tests. They use your installed Chrome; set `PLAYWRIGHT_CHANNEL=msedge` or `""` for bundled Chromium |
| `npm run check` | Lint, typecheck, unit tests, and build |
| `npm run sample-deck` | Regenerate `public/sample-deck.pdf` (the first-run sample, also a test fixture) |

## Deployment

The app builds to a Cloudflare Worker (`worker/index.ts`) with static assets, and is configured for
the hosting described in `.openai/hosting.json`.

1. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as secrets in the hosting environment.
2. Run `npm run check`, then deploy the `dist/` output.

The Worker adds a strict Content Security Policy and security headers to every response. No
database, bucket, or queue is required.

## Supported files and limits

- **PDF** gives exact visuals and is the recommended format. Keynote and Google Slides should be
  exported to PDF first.
- **PowerPoint (.pptx)** is read in the browser: order, text, speaker notes, and the largest picture
  per slide. Slides appear as simplified previews. Charts, SmartArt, animations and video are
  flagged, and the fix is to export a PDF and use **Replace slides** (scripts carry over by content).
- **Images** (PNG, JPEG, WebP): multiple files are ordered by name and can be reordered in setup.
- Up to 100 MB per file and 120 slides per presentation. Legacy `.ppt` is not supported.

## Keyboard shortcuts (Presenter)

`Space` scroll · `→`/`PageDown` next · `←`/`PageUp` previous · `↑`/`↓` nudge · `Home`/`End` start or
end of slide · `B` blank audience · `C` cues · `M` mark slide · `+`/`−` pace ·
`F` full screen · `Esc` cancel or end · `?` all shortcuts

Editor: `Ctrl/⌘ K` add cue · `Ctrl/⌘ B`/`I` bold/italic · `Alt ↑`/`↓` switch slides · `Ctrl/⌘ S` save now.

## Known limitations

- The presenter and audience windows sync through `BroadcastChannel`, so they must be in the same
  browser profile on the same computer. That is the usual projector or screen-share setup.
- Browsers can't choose which monitor a window opens on or hide a window from screen capture. The
  preflight checklist walks through sharing only the audience window.
- On Windows, `vinext start` (vinext 0.0.50) fails to serve static assets. Use `npm run preview` to
  check production builds locally; deployed Workers aren't affected.
