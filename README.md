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

Contributor and agent guidance lives in [`CLAUDE.md`](CLAUDE.md); it distinguishes the
working app from the planned cloud pilot. Earlier planning documents are in git history.
The original [product overview](Docs/PRODUCT_OVERVIEW.md) lives in the root `Docs/`
folder and is the source of truth for product requirements.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For AI writing | Server-side key for the OpenAI Responses API. Never sent to the browser. |
| `OPENAI_MODEL` | No | Model for every AI stage (default `gpt-5.4-mini-2026-03-17`). Must support structured outputs and image input. Use a dated snapshot so usage counts toward OpenAI's complimentary data-sharing tokens. |
| `OPENAI_WRITER_MODEL` | No | A different model for script writing and rewrites only (for example `gpt-5.4-2026-03-05`). Defaults to `OPENAI_MODEL`. A full-size model costs more and draws from the smaller complimentary pool. |
| `OPENAI_BASE_URL` | No | Point at an OpenAI-compatible proxy or gateway. |
| `AI_PROVIDER` | No | `demo` forces the keyless demo provider (development and tests). |

With no key and no `AI_PROVIDER`, a production build shows a calm "AI isn't set up" state. People
can still import, write scripts by hand, and present.

## How it works

```text
Browser (everything the user creates lives here)
 ├─ Import: pdf.js renders PDFs; PPTX is parsed from OOXML; images are normalized
 ├─ IndexedDB: projects, slide images (Blobs), script versions, presenter sessions
 ├─ Orchestrator: analyze → deck context → plan (local) → outline → write → delivery, in bounded batches
 ├─ Editor (Lexical), Presenter, Review
 └─ Audience window ◀── BroadcastChannel (slide index, blank, ended — never script text)
                │
                ▼  /api/ai/*  (Next.js route handlers)
AI gateway: schema-validated requests → OpenAI structured outputs → validation
```

- **Local-first.** Decks, scripts and history are stored in the browser's IndexedDB, and all storage
  goes through [`lib/store/db.ts`](lib/store/db.ts) so a sync backend can be added later. Settings has
  backup/restore (`.cueframe` files) and delete-everything.
- **AI pipeline.** [`lib/ai/orchestrator.tsx`](lib/ai/orchestrator.tsx):
  - Analysis starts as soon as slides are imported. It reads each slide's image and text and
    prefills the setup form with suggestions.
  - Generation plans a word budget per slide ([`lib/domain/planner.ts`](lib/domain/planner.ts)),
    outlines the narrative arc, then writes four slides per model call, three calls at a time.
  - A versioned runtime guide supplies relevant speech examples; full scripts, notes and keyword
    cues have separate instructions. The first slide opens with a greeting ("Hello, everyone.") and
    the last closes with thanks ("Thank you, everyone."); code adds either line if the model omits it.
  - The writing guide paraphrases routine change/feature lists into grouped spoken summaries,
    with relevant highlights. Ordered instructions and important comparisons retain their detail.
    Thin slides stay brief rather than being padded.
  - Local checks (figures not found in the slide, unreadable slides, very short drafts) become
    private notes. They never block saving and never call a model.
  - Delivery coaching runs once after prose is final: one model read answers per-sentence
    questions, and fixed rules place pauses, bold and slow. A slide never opens with a pause. If the
    read fails, built-in rules place the cues. Fallback status, model and prompt versions, latency
    and token usage are kept with the draft in local storage.
  - A draft is saved only when every slide came back valid, and earlier versions are kept in History.
- **Rewrites.** Actions work on a slide or on selected text (shorten, simplify, clearer transition,
  add example, and so on). They always show a proposal to accept or discard, and never overwrite
  silently.
- **Presenter.**
  - Scrolling speed comes from your words per minute, with a reading line at eye level.
  - Auto-advance uses a countdown you can cancel. Reading modes are full script, short, keywords
    and cues only.
  - Per-slide timers, blanking the audience screen, and a keep-awake lock.
  - Clicker keys work in both windows.
- **Privacy.** The audience window loads only slide images. Scripts and cues never cross the sync
  channel, and an end-to-end test checks this. AI requests contain slide images, slide text and the
  brief, only when the user asks for a script or rewrite. The server doesn't log content.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:demo` | Development server (real AI / demo AI) |
| `npm run build` | Production build (`next build`) |
| `npm run preview` | Serve the production build locally (`next start`), including security headers |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit and API integration tests (demo provider, no network) |
| `npm run eval` | Paid evaluation, disabled by default. Requires explicit `--live=true --deck=<name> --budget=<token-cap>` after agreeing on spending. Saves scripts and diagnostic scores in `outputs/`. |
| `npm run test:e2e` | Playwright end-to-end tests against a production build. They use your installed Chrome; set `PLAYWRIGHT_CHANNEL=msedge` or `""` for bundled Chromium |
| `npm run check` | Lint, typecheck, unit tests, and build |
| `npm run sample-deck` | Regenerate `public/sample-deck.pdf` (the first-run sample, also a test fixture) |

A generation makes one analysis call per four slides, one context call, one outline call, one
write call per four slides, and one delivery call per eight slides, all on `OPENAI_MODEL` unless
`OPENAI_WRITER_MODEL` is set. There are no automatic review, repair or retry-for-quality passes.
API token caps are not dollar limits. No further paid experiments are currently authorized; the
historical study in [research/](research/script-quality.md) measured an earlier, heavier pipeline.

## Deployment

The app is a standard Next.js build, intended for Vercel (see the product overview, section 25).

1. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as sensitive environment variables.
2. Run `npm run check`, then deploy; Vercel runs `next build` itself.

`next.config.ts` adds security headers to every response and a strict Content Security Policy to
production builds. No database, bucket, or queue is required yet.

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
end of slide · `B` blank audience · `C` cues · `+`/`−` pace ·
`F` full screen · `Esc` cancel or end · `?` all shortcuts

Editor: `Ctrl/⌘ K` add cue · `Ctrl/⌘ B`/`I` bold/italic · `Alt ↑`/`↓` switch slides · `Ctrl/⌘ S` save now.

## Known limitations

- The presenter and audience windows sync through `BroadcastChannel`, so they must be in the same
  browser profile on the same computer. That is the usual projector or screen-share setup.
- Browsers can't choose which monitor a window opens on or hide a window from screen capture. The
  preflight checklist walks through sharing only the audience window.
