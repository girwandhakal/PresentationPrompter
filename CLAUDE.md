# Cueframe contributor and agent guide

This is the single agent guidance file. Updated 2026-09-27 from the former
`.agents` documents, editor specifications, UI guidance, and current implementation.
The original [product overview](Docs/PRODUCT_OVERVIEW.md) lives in `Docs/`
and is the source of truth for product requirements; do not edit, move, or remove
it without an explicit request. Explicit user instructions take precedence.
Earlier plans are in git history (for example `.agents/docs/` before
2026-09-27); they are reference material, not additional active instructions.

## Product and current implementation

Cueframe (repository: PresentationPrompter) turns an existing slide deck into a
private, slide-aware script and teleprompter. Help prepared and introverted presenters
sound natural, stay oriented, and recover calmly. The presenter controls the pace
and wording. Avoid performance scores, gamification, or pressure to read verbatim.

The current flow is import → optional analysis suggestions → setup → generate →
edit → present → timing review. Imports support PDFs, PPTX, and ordered images;
playback uses normalized slide images. PowerPoint animations and transitions are
outside the current scope. Reopening a project must reuse its saved draft.

The working stack is TypeScript, React, and Next.js App Router, built with
`next build` for Vercel. Projects, slide blobs, scripts, versions, and sessions live
in IndexedDB, one database per signed-in account. Firebase Google sign-in gates
the workspace, and the AI routes verify the Firebase ID token (`proxy.ts` screens
first). Local writes mirror to the account in Firestore/Storage (`lib/store/cloud.ts`,
newest `updatedAt` wins), AI calls draw on Firestore quotas (`lib/ai/server/quota.ts`),
and a blocking function caps signups (`functions/`). Durable server jobs are still planned.

| Area | Implementation |
| --- | --- |
| Routes and shared UI | `app/`, `app/components/ui/` |
| Styling and design tokens | `app/styles/`, especially `tokens.css` |
| PDF, PPTX, and image import | `lib/import/` |
| Typed project, script, timing, cue models | `lib/domain/` |
| Persistence and migrations | `lib/store/` |
| Generation and request orchestration | `lib/ai/orchestrator.tsx` |
| Server prompts, writing guide, providers | `lib/ai/server/` |
| AI route validation and responses | `app/api/ai/`, `lib/ai/schemas.ts` |
| Audience synchronization | `lib/sync/protocol.ts`, `app/audience/` |
| Firebase sign-in, rules, rules tests | `lib/auth.tsx`, `lib/firebase/`, `lib/ai/server/auth.ts`, `firestore.rules`, `storage.rules`, `tests/rules/` |
| Hosting and security headers | `next.config.ts`, `proxy.ts` |
| Script-quality audit and recorded experiments | `research/` |

Preserve these boundaries and existing migrations. Do not remove hosting adapters
or replace the architecture based on a historical plan during unrelated work.

## Script quality and cost

- The script should explain the slide in natural spoken language, grounded in
  slide text, speaker notes, and presenter context. Separate uncertain visual
  observations from supplied facts; do not invent numbers, outcomes, or advice.
- Paraphrase routine change, feature, and status lists as grouped summaries with
  one or two useful highlights. Preserve ordered instructions, meaningful
  comparisons, essential constraints, and details the presenter explicitly requests.
- Respect the goal, audience, depth, terminology, time allowance, and speaking rate.
  Full scripts, speaker notes, and keyword cues need distinct output styles.
  Keep sparse slides brief rather than padding them to meet a word target.
- Runtime prompting belongs in `lib/ai/server/writing-guide.ts` and `prompts.ts`.
  Research documents are supporting evidence; changing them alone does not change
  generation. Version meaningful prompt changes and retain usage/model provenance.
- The pipeline is analyze → deck context → local plan → outline → write (four slides
  per call) → delivery (one read). There is no model reviewer, editor, repair, or
  voting pass; do not add one without a product decision. Local figure/coverage
  diagnostics are private advice and must not block a usable draft. Empty output,
  malformed structure, and mismatched slide IDs still fail.
- The first slide opens with a greeting ("Hello, everyone.") and the last closes with
  thanks ("Thank you, everyone."), enforced in `frameTalk` (`lib/ai/validate.ts`) as
  well as the prompt. No slide opens with a Pause cue.
- Save a complete draft as a new version only after every slide is structurally
  valid. Preserve the previous script on failure or cancellation. Rewrites are
  explicit accept/discard proposals and must not silently overwrite edits.
- Delivery markings are private and added after prose. Current cue lines support
  **Pause**; bold supplies emphasis and slow marks pacing. Do not resurrect older
  gesture, pointing, or look-up cues without a separate product change.
- **No further paid OpenAI experiments are authorized.** Use demo providers, unit
  tests, and saved-result analysis. A key in `.env.local` is not spending consent.
  Live evaluations require a newly agreed scope and token budget, plus explicit
  live/deck/budget flags (and named variants for comparisons). Token caps are not
  dollar caps. Do not add silent model passes, judges, or paid fallback calls.
- Keep credentials and SDK calls server-side. Do not log slide/script content or
  secrets. Inspect aggregate telemetry without exposing private presentations.

## Editor, presenter, and privacy

Use the existing Lexical editor and typed script serialization. Formatting, stable
block IDs, inline cue nodes, undo/redo, autosave, reload, and Presenter preview must
remain consistent. Visual gutter numbers represent wrapped display rows and are
derived from layout; they are not stored script blocks or copied text. Recalculate
them efficiently after content, font, width, and formatting changes.

Support normal bold/italic shortcuts, keyboard navigation, selection, and reversible
AI edits. Do not substitute a textarea, source-code editor, or `execCommand` for the
rich-text surface. Reuse the existing editor and history infrastructure.

Keep live playback state separate from saved script content. Preserve manual
navigation, cancelable auto-advance, adjustable scrolling, blanking, recovery,
session timing, and long-script usability. Opening the audience window requires
a user action; handle blocked or closed windows with a clear retry path.

The audience receives slide assets and minimal playback state only. Never send
script text, notes, cues, or support content over its synchronization channel.
Teach selected-window sharing: browsers cannot guarantee that a private window
will remain hidden when the user shares the entire desktop.

## UI standards

Reuse shared controls and the existing token system. The palette is Powder Petal
`#FCE4D8`, Pitch Black `#070600`, and Blue Bell `#279AF1`; blue denotes presenter-private
information. Existing font, contrast, motion, and spacing tokens are authoritative.

Build with normal responsive document flow, grid/flex, intrinsic sizing, and semantic
HTML. Verify narrow screens, long text, missing data, pending operations, failures,
disabled states, keyboard focus, reduced motion, and large text. Avoid screenshot-only
absolute positioning and duplicate local versions of shared components.

Keep controls familiar, labels concrete, and hierarchy clear. Avoid decorative
gradients, floating glass panels, oversized rounded cards, unnecessary pills, fake
metrics, animated hover transforms, and marketing copy inside the workspace. Motion
should clarify state and respect reduced-motion settings. Avoid hardcoded dimensions
that break wrapping or prevent the interface from scrolling.

## Planned deployed pilot — not current behavior

The product overview updated on 2026-09-27 selected native Next.js on Vercel with
Firebase Authentication/Identity Platform, Firestore, and private Firebase Storage
in `us-east1`. This supersedes older FastAPI/Celery/Postgres and alternative hosting
plans. Implement this migration only in a task that requests it; validate current
vendor documentation and eligibility before provisioning or changing dependencies.

- Add a public landing page and Google login; admit at most ten pilot accounts
  through invitations/approved identities and an atomic provider signup gate.
  Existing users can still log in when capacity is full.
- Generate the first draft after valid import, required consent, and quota admission;
  optional brief adjustments must not block it or launch duplicate jobs.
- Make owned cloud projects canonical; keep per-user local recovery caches, offer
  explicit migration of existing local projects, and isolate caches across accounts.
  Authorize browser access with Security Rules and every privileged server operation
  with ownership checks. Keep authoritative quotas and job state server-controlled.
- Use durable jobs, idempotency, checkpoints, bounded retries, revision-aware saves,
  cancellation, and atomic usage/concurrency reservations. Account for actual usage
  from every stage and retain reservations when provider billing is uncertain.
- Provisional limits: 20 slides, 20 MB/import, 5 projects and 100 MB storage/user;
  up to 5 generations/user/UTC day, 80,000 tokens/job, 400,000 tokens/user/day;
  2,000,000 tokens/day shared first-come; one job/user and two globally. These are
  ceilings and planning defaults, not measured capacity or guaranteed allowances.
- The owner's stated 2,500,000 complimentary tokens/day is an unverified organization
  allowance assumption. Confirm models, eligibility, expiry, reset, other traffic,
  and overflow before launch. Default paid overflow off; never launch benchmarks
  under this assumption without new spending authorization. Hosting cost estimates
  in the product overview are planning figures, not a promise of free operation.
- Provide export, clear deletion behavior, server-validated upload/storage limits,
  private object access, reconciliation, and quota/reset messages. Automated cloud
  backup/restore is outside the proposed pilot; disclose its deletion consequences.
  Full deck editing, animation preservation, live speech rewriting, collaboration,
  meeting-app integration, and guaranteed capture exclusion remain deferred.

Detailed requirements and launch gates are in the [product overview](Docs/PRODUCT_OVERVIEW.md).

## Working and verification

Inspect the relevant code and current diff before editing; preserve existing user
work. Make focused, reviewable changes inside the workspace. Use existing repository
tooling rather than installing system packages or creating a new container workflow
as a side effect. Never print credentials or broad environment dumps. Remote changes
must stay within the user's authorization.

For library, framework, SDK, API, CLI, or cloud-service questions, use Context7:
resolve the library ID first (unless an exact `/org/project` ID is supplied), choose
the relevant version and authoritative match, then query a focused concept. Separate
distinct concepts into separate queries. This is unnecessary for local refactoring,
business-logic debugging, code review, or general programming concepts. Prefer primary
sources and establish the date for time-sensitive research.

Use Node.js 22.13 or newer. Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev:demo` | Keyless development; use this for UI verification |
| `npm run dev` | Development with the configured provider |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm test` | Offline unit/API tests |
| `npm run build` / `npm run preview` | Build and locally serve the production app |
| `npm run test:e2e` | Demo-mode browser journeys |
| `npm run test:rules` | Firestore/Storage rules in the emulators (JDK 21+) |
| `npm run check` | Lint, typecheck, offline tests, build |

Choose verification appropriate to the change. For source changes, run relevant
tests and the standard checks; do not repeat broad checks without a new reason.
Report the outcome and any real limitations. Keep this guide concise and update it
when decisions change; do not recreate separate `.agent` continuity files or copies
of these rules. Keep research evidence in `research/` and temporary outputs in
`outputs/`. The `.claude` JSON files remain tool configuration, not duplicated prose.

## Third-party notice

The condensed UI guidance above incorporates the former Uncodixfy guidance
(https://github.com/cyxzdev/Uncodixfy), used under its license below.

MIT License

Copyright (c) 2026 cyxzdev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
