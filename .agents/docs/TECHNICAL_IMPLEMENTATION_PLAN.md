# PresentationPrompter Technical Implementation Plan

This is an implementation specification, not a roadmap. It contains no phases or dates. It defines the complete web-first product described in `PRODUCT_OVERVIEW.md`.

## 1. Architecture decision and sufficiency

**Yes: Next.js for the frontend and FastAPI for the backend are sufficient for the entire product.** They are the two application runtimes. FastAPI alone is not the whole infrastructure, however. A production implementation also requires PostgreSQL for durable relational data, S3-compatible object storage for source decks and rendered assets, Redis plus a durable worker queue for long-running work, and an AI provider accessed only by the backend.

Use this boundary:

~~~text
Browser
  ├─ Next.js application: workspace, setup, script editor, Presenter tab,
  │  audience window, local UI state, BroadcastChannel synchronization
  └─ direct signed upload/download only for authorized private assets
                │
                ▼
FastAPI service
  ├─ authenticated REST API and OpenAPI contract
  ├─ project, script, setup, export, and session services
  ├─ signed object-storage URLs and upload finalization
  ├─ AI gateway and structured-output validation
  └─ job creation, status, retry, and cancellation APIs
                │
      ┌─────────┼──────────┐
      ▼         ▼          ▼
 PostgreSQL   Redis     S3-compatible object storage
      │         │          │
      └──── job worker ───┘
             ├─ PDF/image normalization and OCR
             ├─ PPTX/PPT extraction and static conversion
             ├─ slide visual analysis
             ├─ full-deck script generation and targeted rewrites
             └─ exports and lifecycle cleanup
~~~

The private Presenter tab and audience presentation window are two routes in the same Next.js application. They synchronize immediate commands with `BroadcastChannel` and `postMessage`; the backend stores recoverable session checkpoints but is not in the latency-sensitive navigation loop. The application controls only its own windows, never arbitrary browser tabs or browser chrome.

## 2. Technology set

| Concern | Required technology | Implementation use |
| --- | --- | --- |
| Frontend | Next.js App Router, React, TypeScript | User-facing application, server-rendered shell, client-side interactive workspace, audience route, and BFF proxy where needed. |
| Backend | FastAPI, Pydantic, Python | Versioned REST API, auth enforcement, OpenAPI schema, project services, signed-storage orchestration, AI gateway, and WebSocket endpoint only for future cross-device session sync. |
| Database | PostgreSQL, SQLAlchemy 2, Alembic | Users, projects, imports, slides, setup briefs, scripts, block revisions, cues, jobs, sessions, and audit metadata. |
| Object storage | Private S3-compatible storage; MinIO locally | Original uploads, normalized PDFs, rendered slide images, thumbnails, exports, and short-lived private download/upload URLs. AWS S3, R2, or another compatible provider are deployment choices, not application dependencies. |
| Job execution | Redis plus Celery worker and Celery Beat | Durable import, conversion, OCR, visual-analysis, generation, export, retry, cleanup, and stale-job tasks. Do not run these jobs with FastAPI `BackgroundTasks`. |
| Slide processing | LibreOffice headless in the worker image, PyMuPDF, Pillow, python-pptx, OCR adapter | Convert PPT/PPTX to static PDF, render PDF pages, normalize images, extract OOXML text/notes, and run OCR only when needed. |
| AI | OpenAI Responses API, backend-only client, Pydantic structured responses | Generate full validated scripts, constrained rewrites, slide observations, visual regions, delivery cues, and question preparation. |
| Client data | TanStack Query plus local React state | Cache API resources, invalidate mutations, persist safe drafts, and avoid component-local state as the source of Presenter truth. |
| Cross-window sync | `BroadcastChannel`, `window.postMessage`, `window.open` | Synchronize the private Presenter route and named audience route in the same browser profile. Validate every message with a schema and session ID. |
| Testing | Pytest, HTTPX, Playwright, Vitest, React Testing Library | Backend, worker, API, browser-window, UI, accessibility, import fixture, and security testing. |
| Deployment | Docker, Docker Compose, CI container builds | Reproducible Next.js, FastAPI, and worker builds; local PostgreSQL/Redis/MinIO; provider-neutral production deployment. |

## 3. Repository layout

Convert the current single Vinext/Worker prototype to the following npm-and-Python monorepo. There is no Tauri, Rust, Cloudflare Worker, D1, or local SQLite application runtime.

~~~text
PresentationPrompter/
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ (workspace)/
│     │  │  ├─ page.tsx
│     │  │  ├─ projects/[projectId]/page.tsx
│     │  │  ├─ projects/[projectId]/import/page.tsx
│     │  │  ├─ projects/[projectId]/setup/page.tsx
│     │  │  ├─ projects/[projectId]/script/page.tsx
│     │  │  ├─ projects/[projectId]/present/page.tsx
│     │  │  ├─ projects/[projectId]/review/page.tsx
│     │  │  └─ settings/page.tsx
│     │  ├─ audience/[sessionId]/page.tsx
│     │  ├─ api/bff/[...path]/route.ts
│     │  ├─ auth/callback/page.tsx
│     │  ├─ layout.tsx
│     │  ├─ page.tsx
│     │  └─ globals.css
│     ├─ components/
│     │  ├─ import/
│     │  ├─ setup/
│     │  ├─ script-editor/
│     │  ├─ presenter/
│     │  ├─ audience/
│     │  ├─ projects/
│     │  └─ ui/
│     ├─ lib/
│     │  ├─ api-client.ts
│     │  ├─ auth.ts
│     │  ├─ bff.ts
│     │  ├─ query-client.ts
│     │  ├─ presenter-channel.ts
│     │  ├─ audience-window.ts
│     │  └─ env.ts
│     ├─ hooks/
│     ├─ public/
│     ├─ tests/
│     ├─ next.config.ts
│     ├─ package.json
│     └─ Dockerfile
├─ services/
│  └─ api/
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ api/v1/
│     │  ├─ core/
│     │  ├─ db/
│     │  ├─ models/
│     │  ├─ schemas/
│     │  ├─ repositories/
│     │  ├─ services/
│     │  ├─ workers/
│     │  └─ tests/
│     ├─ alembic/
│     ├─ pyproject.toml
│     ├─ Dockerfile
│     └─ Dockerfile.worker
├─ packages/
│  ├─ domain/
│  ├─ api-contract/
│  ├─ setup-planner/
│  ├─ presenter-engine/
│  ├─ script-editor/
│  ├─ ui/
│  ├─ config/
│  └─ test-fixtures/
├─ infrastructure/
│  ├─ compose/
│  ├─ nginx/
│  ├─ storage/
│  └─ scripts/
├─ docs/
├─ .agents/
├─ docker-compose.yml
├─ package.json
├─ pnpm-workspace.yaml
├─ pyproject.toml
├─ .env.example
├─ eslint.config.mjs
├─ playwright.config.ts
├─ vitest.workspace.ts
└─ README.md
~~~

## 4. Root, container, and configuration files

- `package.json`: Define workspace scripts for `dev:web`, `build:web`, `lint`, `typecheck`, `test:web`, and `test:e2e`. Remove Vinext, Wrangler, D1, and desktop commands.
- `pnpm-workspace.yaml`: Include `apps/*` and `packages/*`.
- `pyproject.toml`: Pin Python version and shared tooling; FastAPI is installed in `services/api/pyproject.toml` with SQLAlchemy, Alembic, Celery, Redis client, boto3-compatible storage client, OpenAI client, image/PDF libraries, and test dependencies.
- `docker-compose.yml`: Start `web`, `api`, `worker`, `postgres`, `redis`, and `minio`. Use named development volumes only for database, Redis, and MinIO state. Do not mount secrets into images.
- `services/api/Dockerfile`: Build a non-root Python API image, install locked dependencies, expose the ASGI service, and run a production ASGI server.
- `services/api/Dockerfile.worker`: Build from the same locked Python dependencies, additionally include the vetted LibreOffice conversion packages, and start Celery worker processes. Only this image may execute conversions.
- `apps/web/Dockerfile`: Build the Next.js standalone output in a Node container, then run it as a non-root process.
- `.env.example`: Document names only: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `NEXT_PUBLIC_API_BASE_URL`, `APP_ORIGIN`, and `AUDIENCE_WINDOW_ORIGIN`.
- `infrastructure/nginx/`: Define optional production reverse proxy rules: `/` to Next.js, `/api/` to FastAPI or Next BFF, strict request-size limits, WebSocket upgrade headers, CSP, and HTTPS-only cookies.
- `.agents/docs/PRODUCT_OVERVIEW.md`: Is the behavioral source of truth. This implementation plan must be amended whenever product decisions change.

## 5. Shared TypeScript packages

### 5.1 `packages/domain`

Create pure TypeScript definitions for `Project`, `Import`, `Slide`, `PresentationBrief`, `ScriptVersion`, `ScriptBlock`, `TeleprompterMarker`, `Cue`, `VisualObservation`, `PresenterSession`, `PresenterSessionState`, `Export`, `Job`, and safe audience payloads. Audience types must never contain scripts, cues, visual observations, user goals, or private notes.

`presenter-events.ts` defines only legal events: start, pause, resume, next, previous, jump, reset-slide, scroll-change, auto-advance, close-audience-window, and restore-checkpoint. Every event has a session ID, monotonic sequence, source window ID, timestamp, and idempotency key.

### 5.2 `packages/api-contract`

Generate TypeScript request and response types from FastAPI OpenAPI in CI, then expose a typed client. Do not hand-maintain duplicate HTTP payload types. Add runtime Zod validation for untrusted cross-window messages and for API payloads used in client components.

### 5.3 `packages/setup-planner`

Implement deterministic word-budget calculations: usable speaking time, Q&A reservation, target WPM, pause allowance, per-slide weights, optional slides, and over-budget warnings. It consumes the AI-inferred deck context plus the user-stated presentation goal; it contains no presentation-type preset catalog. The backend repeats critical validation before generation.

### 5.4 `packages/presenter-engine`

Implement a pure reducer and monotonic clock abstraction for the one Presenter mode. It advances slides, keeps teleprompter position aligned to script blocks, honors manual override over auto-scroll, and stops at the final slide. It produces a redacted audience snapshot and full private snapshot from the same source state. Unit-test every transition without React or browser APIs.

### 5.5 `packages/script-editor`

Implement editor-specific transformations rather than a generic rich-text document model: split/merge/reorder blocks; full/concise/cue-only variants; line and reading-break calculations; pause, emphasis, pronunciation, and beat markers; cue anchors; per-slide timing; fallback scripts; and Presenter preview layout calculations. Every transformation retains stable block IDs so Presenter state and revisions survive edits.

### 5.6 `packages/ui`, `packages/config`, and `packages/test-fixtures`

`ui` contains accessible low-stimulation primitives, tokens, dialogs, form controls, status messages, and focus-visible behavior. `config` centralizes file limits, image dimensions, slide limits, generation limits, allowed MIME types, job retry policy, and CSP-safe origins. `test-fixtures` holds benign PDF, PNG/JPEG, PPTX, malformed PPTX, long deck, chart, diagram, and timing fixtures; never commit real user decks.

## 6. Next.js frontend implementation

### 6.1 Application shell, routes, and page responsibilities

`app/(workspace)/layout.tsx` renders a persistent application shell for every private workspace route. It is a calm, ChatGPT-inspired layout pattern—fixed project sidebar plus focused content pane—not a chat UI and not a visual clone of ChatGPT. The shell owns the responsive sidebar state, project switcher data, keyboard focus order, and route transitions. It remains out of the audience route.

- `app/(workspace)/page.tsx`: Project home in the shared shell. Show the empty workspace or the selected project overview; do not render marketing content.
- `app/(workspace)/projects/new/page.tsx`: Centered add-presentation flow. It uses one persisted creation draft and has exactly three ordered sections: upload slides, edit required details, and a bottom Generate teleprompter script action.
- `projects/[projectId]/page.tsx`: Existing-presentation overview. Render title, quiet saved state, project action menu, primary Start presentation action, slide rail, large selected-slide preview, current script/cue/timing summary, and Presenter preview in one responsive workspace.
- `import/page.tsx`: Deep link to the upload/review portion of the create flow. File selection, signed-upload preparation, local validation, import job state, static-slide review, and corrections live here; the browser never parses PPTX.
- `setup/page.tsx`: Deep link to the required-details portion of the create flow. Ask for user-stated goal, audience, duration, Q&A time, speaking rate, script depth, delivery style, cue density, and constraints. Display editable AI-inferred deck context as a suggestion, never as a preset.
- `script/page.tsx`: Dedicated teleprompter script editor after completed generation. Do not render generation stages, partial slides, token output, or a chat transcript.
- `present/page.tsx`: Private Presenter tab. It owns the live reducer, controls, teleprompter, private current/next slide context, cues, timing, preflight, and audience-window lifecycle.
- `audience/[sessionId]/page.tsx`: Slides-only route. It accepts only a short-lived audience session token, never fetches project or script content, and renders redacted slide state.
- `review/page.tsx`: Session timing, repeated/skipped slides, and suggested editor actions. It is a report inside the single Presenter-mode workflow, not a rehearsal mode.

### 6.2 Workspace and feature components

- `components/workspace/WorkspaceShell.tsx`: Composes `PresentationSidebar` and the active main-pane route. Provides skip navigation, responsive drawer behavior, and no product-marketing content.
- `components/workspace/PresentationSidebar.tsx`: Fetches the user's presentation list, renders **Add presentation**, searchable recent projects, active-route state, and bottom settings/account controls.
- `components/workspace/PresentationListItem.tsx`: Renders title, compact import/script status, active styling, accessible project link, and a separately focusable three-dot action trigger.
- `components/workspace/PresentationActionsMenu.tsx`: Contains rename, open overview, edit setup, duplicate, replace imported deck, export, and delete actions. Confirm destructive actions; do not expose slide-authoring controls that imply PowerPoint editing.
- `components/workspace/AddPresentationFlow.tsx`: Persists the draft and renders upload, required-details, and generation sections in order. Switching projects must not discard a valid in-progress draft.
- `components/workspace/CreationStepHeader.tsx`: Shows the three fixed labels and validation state without creating a modal or chat-style interaction.
- `components/workspace/GenerateScriptFooter.tsx`: Sticky bottom action area. Shows word-budget summary, required-field errors, and disabled/enabled Generate teleprompter script button. It transitions to a calm non-observable completion state after submission.
- `components/workspace/PresentationOverview.tsx`: The existing-project main layout: selected-slide rail, slide preview, script/cue/timing summary, delivery preview, edit entry points, and Start presentation action.
- `components/workspace/ProjectHeader.tsx`: Shows project title, quiet autosave status, overflow actions, and the single high-emphasis Start presentation button.
- `components/setup/DeckContextSuggestion.tsx`: Show inferred context with confidence and editable wording. Never require the user to choose a presentation category.
- `components/setup/PresentationGoalField.tsx`: Required goal prompt with examples, validation, autosave, and a plain-language explanation that this guides the draft.
- `components/setup/WordBudgetPlanner.tsx`: Render planner output, constraints, and explicit rebalancing choices.
- `components/script-editor/TeleprompterEditor.tsx`: Main editing shell with slide navigator and selected-script editor.
- `components/script-editor/ScriptBlockEditor.tsx`: Edit spoken text and markers without exposing audience-facing markup.
- `components/script-editor/MarkerToolbar.tsx`: Insert pause, emphasis, pronunciation, beat, and reading-break markers.
- `components/script-editor/TimingPanel.tsx`: Show current/total duration, word count, target time, overflow, optional-slide state, and WPM estimate.
- `components/script-editor/VariantsPanel.tsx`: Edit full, concise, fallback, and cue-only variants independently while preserving canonical script links.
- `components/script-editor/PresenterPreview.tsx`: Render exactly the selected script block's Presenter-mode reading width, markers, cue placement, and scroll behavior.
- `components/script-editor/TargetedAiActions.tsx`: Submit selected-text rewrite operations; no generic chat panel and no full-deck overwrite without confirmation.
- `components/presenter/PresenterCoordinator.tsx`: Instantiate the shared reducer, persistence checkpoints, and window transport.
- `components/presenter/AudienceWindowControl.tsx`: Call `window.open` synchronously from the user's explicit click, reuse a named window, detect a blocked popup, and expose retry/help UI.
- `components/presenter/PreflightChecklist.tsx`: Confirm title, active script, audience window, slide count, keyboard controls, and selected-window sharing.
- `components/audience/AudienceCanvas.tsx`: Render only the selected slide asset, progress, and permitted slide metadata.

### 6.3 Frontend libraries and browser behavior

`lib/api-client.ts` uses generated OpenAPI types and credentials-safe fetch settings. `lib/bff.ts` implements a narrow optional Next Route Handler proxy for authenticated browser mutations when the API lives on another origin; it validates path allowlists and never becomes a second business-logic backend. `lib/workspace-draft.ts` stores only a user-owned add-presentation draft and its validation state, restores it when the user returns, and clears it only after project creation or explicit discard. `lib/presenter-channel.ts` validates BroadcastChannel and postMessage envelopes and ignores unknown versions, origins, session IDs, or sequences. `lib/audience-window.ts` opens `/audience/{sessionId}` from a direct click, stores the `Window` reference, and detects closure.

Use a `BroadcastChannel` named per session for same-browser real-time state. Send a full safe snapshot when the audience window announces readiness, then send sequenced state events. Persist checkpoints to FastAPI at bounded intervals and on visibility/unload best effort; do not make navigation wait for a network request. If the audience window is blocked or closes, preserve the private session and provide a user-click retry path.

## 7. FastAPI backend implementation

### 7.1 Application structure

~~~text
services/api/app/
├─ main.py
├─ api/v1/
│  ├─ router.py
│  ├─ auth.py
│  ├─ projects.py
│  ├─ imports.py
│  ├─ uploads.py
│  ├─ briefs.py
│  ├─ scripts.py
│  ├─ cues.py
│  ├─ presenter_sessions.py
│  ├─ exports.py
│  ├─ jobs.py
│  ├─ settings.py
│  └─ websocket.py
├─ core/
│  ├─ config.py
│  ├─ security.py
│  ├─ auth.py
│  ├─ errors.py
│  ├─ logging.py
│  └─ rate_limit.py
├─ db/
│  ├─ session.py
│  ├─ base.py
│  └─ migrations.py
├─ models/
├─ schemas/
├─ repositories/
├─ services/
├─ workers/
└─ tests/
~~~

`main.py` creates the FastAPI app, CORS policy, trusted-host policy, request IDs, exception handling, health endpoints, OpenAPI metadata, and the versioned router. `core/auth.py` verifies the chosen OIDC/JWT identity and creates an authorization context. Every project-scoped endpoint receives that dependency before repository access. `core/errors.py` maps internal exceptions to stable user-safe error codes and never returns provider traces.

### 7.2 API contract

Implement `/api/v1` endpoints:

- `POST/GET /projects`, `GET/PATCH/DELETE /projects/{project_id}`, and project duplication. The list response includes only sidebar-safe fields: ID, title, updated time, import status, script status, and active script indicator.
- `GET /projects/{project_id}/workspace`: Return the compact existing-presentation overview payload: project header, active import, ordered slide summaries and signed preview references, active script summary, current cue/timing summary, available edit actions, and whether Start presentation is enabled. Do not make the client compose this view from dozens of requests.
- `POST /projects/{project_id}/uploads/initiate`, upload-completion validation, and signed private download creation.
- `POST /projects/{project_id}/imports`, `GET /imports/{import_id}`, correction, replacement, cancellation, and deletion.
- `GET/PATCH /projects/{project_id}/brief`, deterministic planning preview, and explicit rebalance request.
- `POST /projects/{project_id}/scripts/generate`, which creates one full-deck job and returns a job ID; `GET /jobs/{job_id}` returns only `queued`, `running`, `completed`, `failed`, or `cancelled`, with no partial script output.
- `GET /projects/{project_id}/scripts`, version selection, block mutation, variant mutation, marker mutation, restore, and focused rewrite endpoints.
- `GET/PATCH /projects/{project_id}/cues` and visual-observation review endpoints.
- `POST/GET/PATCH /projects/{project_id}/presenter-sessions` for preflight, bounded checkpoint persistence, completion, and session review.
- `POST /projects/{project_id}/exports` and `GET /exports/{export_id}` for authorized short-lived download URLs.
- `DELETE` endpoints for source revisions, assets, scripts, projects, and account data with explicit deletion scope.
- `GET /healthz` and authenticated `/readyz` for deployment checks.

Use idempotency keys for import creation, generation, targeted rewrite, export, and deletion requests. Validate every body with Pydantic; return revision/version fields on all mutable records. Generate OpenAPI in CI and fail if TypeScript client generation detects a breaking unreviewed change.

### 7.3 Services and repositories

Repositories encapsulate SQLAlchemy queries and must not contain AI, storage, or HTTP logic. Services coordinate authorization, transactions, object storage, jobs, revisions, audit events, and user-safe errors. Create `ProjectService`, `UploadService`, `ImportService`, `BriefService`, `ScriptService`, `CueService`, `PresenterSessionService`, `ExportService`, `DeletionService`, `JobService`, and `AiGateway`.

`AiGateway` is the only module that imports the AI SDK. It minimizes context, applies the model and request limits, parses structured output, validates visual regions and slide IDs, records redacted provenance, and never exposes API credentials or raw provider diagnostics.

## 8. Database, object storage, and queue

### 8.1 PostgreSQL tables

Create SQLAlchemy models and Alembic migrations for:

- `users`, `auth_identities`, `user_preferences`;
- `projects`, `project_members`, `project_deletions`;
- `source_imports`, `slides`, `slide_assets`, `asset_deletions`;
- `presentation_briefs`, `brief_plans`, `deck_context_inferences`;
- `script_versions`, `script_blocks`, `script_block_variants`, `teleprompter_markers`, `script_revisions`;
- `visual_observations`, `visual_regions`, `delivery_cues`, `audience_questions`;
- `jobs`, `job_attempts`, `job_events` (internal operational records only);
- `presenter_sessions`, `presenter_checkpoints`, `presenter_events`, `presenter_metrics`;
- `exports`, `audit_events`, and `idempotency_keys`.

Use UUID primary keys, `created_at`, `updated_at`, actor IDs, revision numbers, foreign keys, ownership indexes, and soft-delete state where retention requires it. Add unique constraints for slide position within an import, asset hashes within a project, idempotency scope/key, and sequence number within a presenter session. Scripts, cues, and blocks are versioned; user edits are never overwritten by AI output.

### 8.2 Object layout and access

Store assets under opaque keys such as `projects/{project_id}/imports/{import_id}/source/{asset_id}` and `projects/{project_id}/slides/{slide_id}/{kind}/{asset_id}`. Keep buckets private. The browser uploads with short-lived, content-type- and size-bound signed URLs, then calls upload completion so FastAPI can verify ownership, expected hash, and object existence before creating database records. Serve private assets through short-lived signed URLs or an authenticated streaming endpoint. Never store public URLs in the database.

### 8.3 Queue and worker rules

Celery tasks receive IDs and revision numbers, never trusted browser payloads. On execution they reload project data, check ownership/revision/cancellation, report internal state, and commit results atomically. Define queues for `imports`, `conversion`, `ocr`, `analysis`, `generation`, `exports`, and `cleanup`. Configure retries only for safe transient failures; conversion errors, malformed uploads, and invalid AI structures fail with a user-actionable result. Use a dead-letter/error policy and a cleanup scheduler for expired uploads, orphan assets, stale jobs, and expired audience-session tokens.

## 9. Import, analysis, and generation implementation

### 9.1 Import pipeline

Accept PDF, supported image sets, PPTX, and PPT only. Validate signatures, MIME type, byte size, archive entry count, decoded image dimensions, page count, and slide count at both browser and backend boundaries. Do not trust extensions or browser MIME values.

PDF imports render pages using PyMuPDF. Image imports normalize orientation, dimensions, thumbnails, and deterministic order. PPTX/PPT imports run only in the isolated worker: inspect OOXML with `python-pptx`, extract text and notes where available, convert through a pinned LibreOffice headless command to PDF, and feed that PDF through the normal render pipeline. Record warnings for animations, transitions, videos, links, or conversion loss. On conversion failure, preserve the source and instruct the user to export a static PDF. Keynote is import-by-PDF-or-image only.

OCR is conditional: run it only for sparse text extraction or a user request. Visual-analysis jobs consume normalized rendered slide images plus extracted text, return structured observations and normalized region coordinates, and never claim uncertain content as fact.

### 9.2 Generation pipeline

The setup API stores the user's stated goal, audience, timing, speaking rate, delivery preferences, constraints, and editable AI-inferred deck context. The planner computes the word budget before a generate request is accepted. The generation worker builds a constrained request from selected slides, normalized text, required facts, visual observations, and planner allocations; requests one structured complete deck response; validates every slide ID, timing estimate, cue anchor, region, and required field; then commits a new `ScriptVersion` only if the entire draft passes validation.

Generation is intentionally non-observable to the presenter. The frontend may poll only for a simple job terminal state; it must not display token streaming, stage names, slide-by-slide progress, partial scripts, or an AI transcript. A failure returns a calm user-safe message and retry/correction action. A completed job transitions the user to the teleprompter script editor.

Targeted rewrite tasks operate on one selected block or cue with the minimum necessary context. They create a proposed revision, preserve user edits, and require confirmation before replacing material user-authored text. Never generate new text during a live Presenter session.

## 10. Dedicated teleprompter script editor

The `/script` route is a dedicated spoken-delivery editor, not a generic document or chat UI. It loads one script version and uses optimistic, revision-checked mutations. The main pane edits the active slide's blocks; the left pane selects slides and reveals timing/overflow state; a responsive layout preserves the same capabilities on smaller screens.

Implement full-text editing, stable block split/merge/reorder, drag-free keyboard alternatives, paragraph and sentence selection, pause/emphasis/pronunciation/beat markers, reading breaks, cue anchors, timing targets, optional-slide flags, concise and cue-only variants, fallback scripts, undo/redo, quiet autosave, and a Presenter visual preview. The preview must reuse `packages/presenter-engine` and `packages/script-editor` calculations so wrapping, marker visibility, reading width, cues, and auto-scroll match live use. Targeted AI buttons are contextual to selection and send typed requests; do not build a generic conversation interface.

## 11. Browser Presenter and audience-window implementation

Starting Presenter mode creates one `PresenterSession` and loads the private `/present` route. The user clicks **Open audience presentation**, which synchronously opens or reuses one named `/audience/{sessionId}` window. Detect `null` from `window.open`, retain private state, and show a retry instruction. Do not auto-open windows after asynchronous work or promise automatic display placement.

The private tab maintains the shared reducer. It broadcasts an initial audience-safe snapshot on audience readiness and subsequent sequenced events. The audience route verifies the short-lived audience token, subscribes to the matching channel, and rejects messages with wrong origin, protocol version, session, or sequence. It contains slide image, slide index, total count, and allowed presentation metadata only. It cannot request scripts or cues from FastAPI.

Private controls implement next/previous/jump/reset, play/pause, manual scroll, smooth auto-scroll, auto-advance at slide-script completion, user override precedence, keyboard navigation, clicker-compatible key input, elapsed/remaining time, current/next slide context, glance/read modes, cue density, reduced motion, mirror mode, focus line, and safe recovery. Persist a bounded checkpoint after meaningful state changes and on completion. The final slide stops rather than loops. Practice-oriented reports are session review inside this one mode, never a rehearsal route.

## 12. Security, privacy, accessibility, and reliability

- Authenticate every FastAPI request and authorize by project ownership before querying records or signing assets. Use HTTPS, secure HTTP-only cookies or verified bearer tokens, CSRF protection for cookie mutations, strict CORS, rate limits, request-size limits, CSP, and audit events.
- Keep AI keys, storage keys, database URLs, and Redis credentials only in API/worker environments. The Next public environment contains only non-secret origins.
- Restrict uploads by signature, size, archive structure, decoded dimensions, and worker timeout. Run conversion in a non-root isolated container with no outbound network except explicitly required AI calls from the gateway.
- Never send private script/cue data to the audience route, BroadcastChannel audience snapshot, export, log, analytics, or error message unless explicitly selected by the user.
- Provide selected-window sharing guidance and distinguish browser titles visibly. State that browser windows cannot guarantee monitor placement or capture exclusion.
- Meet WCAG 2.2 AA: semantic labels, keyboard operation, focus visibility, large text, high contrast, reduced motion, live-region error messages, and no color-only timing/cue indicators.
- Handle expired signed URLs, failed conversion, AI timeout, malformed AI output, database failure, storage mismatch, job retry, blocked popup, audience-window closure, stale revision, lost network, and interrupted session with typed recoverable errors. Preserve the last valid import and script until an explicit replacement succeeds.

## 13. Test and quality files

- `services/api/app/tests/unit/`: planner, authorization, revision, signed-upload, AI schema, visual-region, job retry, and deletion tests.
- `services/api/app/tests/integration/`: FastAPI endpoints through HTTPX, disposable PostgreSQL, Redis/worker task execution, MinIO private objects, Alembic migrations, and OpenAPI contract checks.
- `apps/web/tests/unit/`: presenter reducer, channel validation, audience-window helper, workspace sidebar, action menu, persisted create-flow draft, three-step validation, project overview layout, editor transformations, marker rendering, API client, and component tests.
- `e2e/`: Playwright tests for anonymous/signed-in project flow, sidebar project switching, three-dot project actions, Add presentation upload-to-details-to-generate order, disabled generation until valid, completed-only generation state, existing-presentation overview, Start presentation, editor tools, audience-window opening/retry, audience privacy, navigation synchronization, auto-advance, recovery, exports, deletion, keyboard operation, responsive sidebar behavior, and accessibility.
- `packages/test-fixtures/`: valid and invalid PDF/image/PPTX fixtures, animations warning fixture, too-large archive, OCR-needed slide, chart/diagram cues, and deterministic AI-response fixtures.
- CI runs formatting, TypeScript typecheck, Python lint/typecheck, unit tests, integration tests, Playwright, migration validation, container builds, dependency scanning, and secret scanning. No test calls a live AI provider by default.

## 14. Deployment and operations

Deploy Next.js, FastAPI, and worker as separately scalable containers. Run PostgreSQL, Redis, and S3-compatible storage as managed private services in production. Configure one origin for the browser app and either a same-site API origin or the explicit Next BFF proxy. Ensure audience routes and API CORS policies permit only the app origin.

Run Alembic migrations as an audited deployment step before API versions that require them. Health checks verify API reachability, database connectivity, Redis availability, storage configuration, and worker queue availability without exposing credentials. Metrics include import failures by type, job queue age, job retries, generation schema failures, storage cleanup failures, audience-window recovery, script timing fit, and private/audience data-boundary violations. Logs use request/job IDs and redaction; never record source deck content, scripts, prompts, or secrets by default.

## 15. Migration from the current repository

- Replace the Vinext/Vite application entry with `apps/web` Next.js App Router files. Reuse only visual primitives and safe UI styling from `CueframeApp.tsx`; do not preserve its hard-coded sample state.
- Replace `app/api/generate-script/route.ts` with FastAPI `/api/v1/projects/{id}/scripts/generate` plus `AiGateway` and Celery generation task. Keep structured AI validation, but move all secrets and business logic out of Next.js.
- Replace empty `db/schema.ts`, `db/index.ts`, Drizzle configuration, `worker/index.ts`, Wrangler configuration, and D1/R2 bindings with SQLAlchemy models, Alembic migrations, repositories, FastAPI routes, storage service, Celery tasks, and Docker configuration.
- Remove all desktop/Tauri, Rust, sidecar packaging, local SQLite, Cloudflare Worker, D1, Durable Object, Queue, and desktop-sync requirements from the implementation. LibreOffice remains only in the isolated Python worker image for static PPTX/PPT conversion.
- Update `README.md` with Next.js/FastAPI local setup, Docker Compose commands, service dependencies, import-format limits, private audience-window workflow, test commands, and secret-free environment setup.

## 16. Completion standard

The implementation is complete only when a user can import a static PDF, image set, or supported PowerPoint deck; state their presentation goal; receive one complete validated script without watching generation internals; refine it in the teleprompter-specific editor; open and control an audience-only browser window from the private Presenter tab; deliver with synchronized slides, scrolling, cues, timing, recovery, and accessibility controls; review the session; export or delete their work; and do so without private script or cue data reaching the audience surface.
