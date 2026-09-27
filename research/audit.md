# Script generation quality audit

> Archived pre-implementation audit. Its observations and acceptance targets describe baseline `eec88cee`; see [the implementation and results](script-quality.md) for current behavior, spending, and incomplete validation. Historical local probes remain in `outputs/script-quality-audit/`; current regression coverage is in `tests/unit/script-quality.test.ts`.

Research date: 2026-09-26 (America/Chicago). Repository audited: `eec88cee706d7612bfce1910f51b11f8e8063986`, on `main`.

Scope: the slide-to-script pipeline, source handling, prompt engineering, spoken-language quality, delivery advice, repairs, and evaluation. The user's priority is awkward spoken language and delivery advice. No application code, deployed model setting, or production data was changed. No new model calls were made for this audit.

## Judgment

The current implementation has a useful foundation: multimodal slide analysis, a narrative outline, a shared voice, bounded slide writing, reversible versions, a speech-pattern lint, and coaching after prose is finalized. The main limitation is the definition and enforcement of quality. The application verifies that a response can be consumed, then relies heavily on the model's own interpretation of natural speech. It does not establish that the talk is coherent, source-faithful, comfortable to deliver, or helpfully coached.

The first improvement should combine a clearer writing guide with better acceptance criteria and a bounded editorial pass that sees the actual draft. Adding more adjectives or a longer generic “expert speechwriter” prompt would leave the demonstrated weaknesses in place.

A runtime writing guide can provide the benefit the user means by a “skill.” A Codex skill installed in the development environment would not affect the current application's API requests. `createOpenAiProvider` sends instruction strings from `prompts.ts`; it does not load repository Markdown, invoke a skills tool, or retrieve an external writing guide. The candidate guides below should become reviewed, versioned application instructions, incorporated at build time or expressed in the existing prompt module.

## Evidence and limits

- Read the prompt builders, provider, orchestrator, request/output schemas, write/rewrite/delivery routes, word planner, cue selector, speech lint, and evaluation harness.
- Read three existing local evaluation reports, covering nine deck runs, 94 slide scripts, and 416 sentences, across engineering review, launch pitch, and introductory lecture fixtures.
- In those historical outputs, 70 of 416 sentences exceeded 20 words (16.8%). Two were 37 words; both pass the current speech-pattern checks. Sentence length is a diagnostic, not a universal quality threshold.
- 84 of 94 slide scripts contained a Pause line; there were 88 Pause lines and 16 slow passages. This describes density, not whether the cues were helpful or excessive.
- Reproduced current validator and cue-selection weaknesses with offline probes. The evidence is in [evidence.json](evidence.json), with the original local probe at `outputs/script-quality-audit/probes.ts`.
- Ran `npm test`: all 59 unit/API tests pass. The API integration tests use the demo provider; they do not measure the quality of live-model prose.
- The saved reports do not identify an exact prompt revision, commit, model snapshot, reasoning settings, or usage. One says `Voice: undefined`. They are illustrative historical evidence, not a controlled benchmark of the exact audited commit or an estimate of production failure rates.
- The proposed guides and architecture changes have not been tested on new model generations. Quality gains, added latency, and token costs remain hypotheses to measure.

## Current pipeline

| Stage | What happens | Quality implication |
| --- | --- | --- |
| Import and analysis | Images are resized to 1280px width for AI; up to four slides are analyzed per batch. Extracted text and notes accompany images when available. | Visual interpretation is compressed into a main point, summary, elements, and uncertainty. Image resolution and missing analysis can limit what the writer knows. |
| Deck context | A model infers topic, audience/goal suggestions, and a short summary from slide summaries. | Helpful context, but inferred intent and summaries are not authoritative evidence. |
| Local planning | Speaking rate and duration produce word targets, weighted mainly by slide complexity. | Complexity allocates time; it does not establish rhetorical importance or how much source material can support. |
| Outline | A model creates an arc, a 2–3 sentence voice, and roles/key ideas/transitions. It sees each slide's main point rather than its complete source content. | Important qualifications or must-include points can be lost before drafting. |
| Writing | Two-slide batches run concurrently, up to six batches at a time, with the shared arc and voice. | Each writer sees a small slice and a planned previous transition, rather than the actual neighboring prose or complete content plan. |
| Speech retry | Regex/number checks can trigger one regeneration. | The quality signal is narrow and the writing retry is not supplied the actual rejected draft. |
| Fit repair | A targeted rewrite can move a slide closer to its word target; support notes may be regenerated. | Selection mainly rewards length fit, with a limited numeric check. The original can survive unresolved problems. |
| Delivery | Eight-slide chunks receive three same-model reads; votes drive fixed placement rules. The default delivery model is full `gpt-5.4`. | Repeated agreement can improve consistency, but does not establish correctness. Fallback rules silently substitute when the pass fails. |
| Save | A complete script set is saved as ready, with version snapshots. | “Ready” means generation completed; it is not a measured speech-quality certification. |

Default writing/analysis model in source: `gpt-5.4-mini`, with low reasoning effort. The real deployment may override it through environment variables. Neither deployment configuration nor private keys were inspected.

## Prioritized findings

### 1. Long, dense speech passes the speech checker

**Confirmed; high priority for this user's complaint.** `prompts.ts:120` requests sentences under roughly 20 words, yet `spoken-lint.ts:70–74` only rejects an average below seven words, when there are at least three sentences. There is no upper-length, clause-density, noun-inventory, referent-clarity, or repetition check.

The saved credential explanation contains this 37-word sentence:

> The Public_Key in the site did not match the Public_Key in the account, so we swapped in test credentials, created a new EmailJS account for testing, and then worked with the sponsor to find the correct credentials.

Current `spokenProblems` returns no problems. An author-edited alternative, using the fixture's source, is:

> The site's EmailJS key didn't match the account key. We replaced the old values with test credentials and created a new account for testing. Then we worked with the sponsor to find the correct credentials. The next deployment will use those values.

The improvement is separating actions and preserving deployment status. This illustration is a human-authored candidate, not an A/B-tested model output.

**Change:** add full-script diagnostics for stacked clauses, long inventories, unclear references, repetition, and unusually long sentences. Use length as a warning to an editor; do not impose a rigid universal sentence ceiling that destroys definitions, technical precision, or natural rhythm.

### 2. The instructions and demonstrations teach different behavior

**Confirmed prompt conflict.** `SPOKEN_STYLE` discourages colons and says lists are never recited; its approved demonstrations use colons, inventories, and sentences longer than the suggested range. Some examples also add details not clearly present in the demonstrated source, such as testing with real customers. Calling the example content invented does not remove the pattern the model is being asked to imitate.

The prompt also asks each slide to frame its content, explain its importance, connect both directions, hit a narrow target, produce support notes, and vary its opening. On sparse slides, these simultaneous requirements encourage generic connecting language.

**Change:** use a short hierarchy of priorities and demonstrations whose factual grounding, sentence rhythm, and status handling satisfy that hierarchy. Replace absolute bans with task-sensitive rules. Ordered steps and a natural spoken colon can be appropriate. Avoid teaching every slide to say “what matters here” or “that sets up.”

### 3. Notes and cue modes conflict with full-script guidance

**Confirmed.** `DEPTH_GUIDE` permits fragments for notes and 1–5 word anchors for cue mode. The same full-speech instructions and speech lint still apply. The offline probe correctly shaped as notes, “Current state. Known gap. Next decision.”, is flagged as clipped speech.

**Change:** separate full-script, notes, and cue-only prompts, repair policies, and validators. Prioritize full-script quality in the first experiment; a note should not be expanded into a speech just to satisfy a checker.

### 4. Neighboring prose is planned, not actually read by the writer

**Confirmed design limitation; impact should be measured.** `orchestrator.tsx:223–235` writes small batches in parallel. `prompts.ts:185` describes `previousTransition` as what the previous slide ends with, but that value comes from the outline. The write model can produce a different ending. The fit rewrite later loses the shared arc, voice, planned role, key idea, and actual neighboring text, because its request schema only carries simpler slide context.

There is no editorial pass over the completed prose. Similar framing can recur even when the first two words differ. A shared voice helps, but it is not the same as global coherence.

**Change:** retain efficient drafting, then add one bounded editing pass over actual adjacent scripts and a compact full-deck content map. It should remove repeated setup/claims, check transitions and terminology, and preserve coverage. For large decks, use overlapping sections and a final boundary check rather than one huge unconstrained rewrite.

Define whether `transition` is spoken prose or an alternative support line. Current generation produces both paragraphs and a separate transition, which can duplicate handoffs. The editorial pass should assess the content actually presented to the user.

### 5. Grounding is mostly numeric occurrence, not claim verification

**Confirmed.** `ungroundedFigures` checks digit values against a set. It does not compare complete claims, units, entities, relationships, causality, or completion status. It ignores all integer values up to ten and numbers spelled out in generated prose. Sources also include presentation duration and generated outline/context text (`spoken-lint.ts:90–102`).

The offline probes all pass without a grounding warning:

| Generated claim | Evidence available | Why it passes |
| --- | --- | --- |
| Revenue was ninety-nine dollars. | Revenue was 61 dollars. | Output number words are not extracted. |
| Revenue rose 8 percent. | No measured growth available. | Small integer exemption. |
| Revenue grew 61 percent. | Revenue was 61 dollars. | Same value, different unit and meaning. |
| We saved 17 million dollars. | Revenue was 61 dollars; speaking duration is 17 minutes. | Planning metadata supplies a matching number. A 19-million control is flagged. |

These are adversarial demonstrations of checker coverage, not claims that the model generated these examples in production.

**Change:** preserve source facts as structured statements with value/unit/entity/qualifier/source IDs, distinguish observations from inferences, and verify critical generated claims against those sources. Do not promote outline wording into factual evidence. Add deterministic quantity normalization and a source-conditioned semantic verifier where needed. Check support notes and rewrites too. No automated verifier should be treated as infallible.

### 6. Repair selection does not establish that the script improved

**Confirmed.** In `openai.ts:103`, the writing retry receives the source and a problem summary, but not the rejected paragraphs. It is a regeneration rather than a localized edit of known text. `pickDraft` selects by problem count and accepts ties. The probe replaces “Revenue was 83 dollars” with “Revenue was 99 dollars” against a 61-dollar source; both have one problem.

The write route's fit selection (`write/route.ts:37–40`) rewards distance to the target and absence of unmatched digit values. It does not independently check essential coverage, new causal claims, or whether the repaired prose is more natural. A closer target can still be a worse script.

**Change:** supply the exact rejected draft, offending spans, authoritative sources, and concrete feedback. Require factual/coverage checks before preference scoring. Accept a revision only if it preserves hard requirements and is judged better on the intended quality dimension. Preserve the original on uncertainty, and expose remaining private diagnostics instead of implying that a retry fixed everything.

### 7. The word budget can encourage filler

**Confirmed conflicting incentives; magnitude unmeasured.** The writing prompt makes ±10% a hard target while also saying not to pad. Code starts full-script repairs only beyond ±20%, so the target policy is inconsistent. A duration/complexity planner can assign substantial time to a thin divider, title, or closing slide.

**Change:** retain a clear overall time goal but allow per-slide ranges based on source richness and rhetorical purpose. Give sparse slides a brief treatment and redistribute time to evidence/explanation. If the material cannot support the requested length, report the conflict. Track must-include coverage when shortening and source support when expanding. Do not ask a model to invent “why it matters” merely to fill time.

### 8. Cue cadence is constrained only by sentence boundaries

**Confirmed behavior; its effect on usefulness is unmeasured.** `cues.ts:174–177` rejects identical gaps. The question/main-point probe produces pauses after sentence one and sentence two. That leaves one complete sentence between the cues and satisfies the current rule and tests. It is not a demonstrated spacing bug. On short sentences, however, that permitted cadence could still feel stop-start. Sentence boundaries do not measure elapsed speaking time or cognitive load.

**Change to experiment with:** compare the current cadence with a more conservative minimum reading-time or two-sentence separation policy. Label genuine audience-interaction exceptions. Keep the current rule unless a read-aloud evaluation shows that the alternative helps; ordinary emphasis should not make the script feel stop-start.

### 9. Delivery voting measures consistency more than usefulness

**Confirmed design; comparative quality remains a hypothesis.** Three reads use the same model, same prompt, and usually reasoning off with temperature zero. Their agreement can stabilize output, but errors can be correlated. Stress requires identical normalized words across all usable reads, so different sensible emphases can all disappear.

The coaching prompt's `mustCatchExactly` includes multiple names, dates, or steps. That encourages slowing inventories that an editor should simplify, even when the audience does not need those details. Classification depends on a model-generated key idea, so an incorrect key idea can also focus emphasis incorrectly. Sentence-count validation permits malformed/duplicate numbering to fall back by position.

**Change:** calibrate examples for important comparisons, definitions, causal limits, and incidental details. Improve prose first. Evaluate cue precision/usefulness and speech continuity against human judgments. Compare three reads with one calibrated read or one read plus verification. Validate exact unique IDs and sentence-number coverage. Preserve whether each slide used AI, fallback, or no guidance.

The supported guidance types are currently Pause, bold, and slow. Pointing/gesture advice is not present in the runtime cue type. Adding it requires grounded visual regions and product support; it should not be slipped into script prose.

### 10. Evaluation rewards proxies and misses this user's definition of quality

**Confirmed.** `scripts/eval.ts` scores word fit, regex lint, unmatched digits, first-two-word opener repetition, and cue counts/difference from fallback. It does not assess semantic fidelity, essential-point coverage, listener comprehension, speaker naturalness, cross-slide repetition, or cue relevance. Different from fallback does not mean better. Guidance on every slide is not a success criterion.

All fixture analysis calls send `image: null`; they cannot evaluate image-only slides, unreadable charts, OCR loss, or spatial interpretation. Reports omit reproducibility and usage metadata. Small synthetic text fixtures are useful, but insufficient to certify the highlight feature.

**Change:** retain these diagnostics and add representative multimodal fixtures, a speech rubric, blinded pairwise comparisons, read-aloud checks, and model/prompt/usage provenance.

### Additional integrity concern

`write/route.ts:23` substitutes output position when a requested slide ID is missing. A malformed ID set could attach another slide's prose to the wrong slide. Strict JSON schemas guarantee shape, not one-to-one identity. Validate requested IDs and reject or selectively retry mismatches. This is a prerequisite for trustworthy slide-specific scripting, independent of prompt style.

## What the research supports

| Primary source | Finding relevant here | Application to this project |
| --- | --- | --- |
| [OpenAI prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering), current docs fetched 2026-09-26 | Effective instruction roles, examples, model snapshots, and representative evaluations matter. | Keep reviewed prompts in application code, fix demonstration conflicts, and record prompt/model provenance. |
| [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), current docs fetched 2026-09-26 | Schema compliance does not prevent mistakes; examples and simpler subtasks can help. | Treat parsing as a format gate. Add semantic and spoken-quality gates. |
| [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices), current docs fetched 2026-09-26 | Task-specific evaluations and human calibration are needed; comparisons are useful. | Compare scripts and coaching blindly, using separate naturalness, fidelity, and cue criteria. |
| [GPT-5.4 Mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini), current docs fetched 2026-09-26 | The model supports multiple reasoning levels; an explicit dated snapshot is available. | Keep the existing model/effort as baseline, then test effort and model separately. No documentation guarantees better speech from more reasoning. |
| [Self-Refine](https://arxiv.org/html/2303.17651v2), Madaan et al., 2023 | Feedback and refinement improved results across the paper's evaluated tasks; specific actionable feedback is central to the approach. | Test a bounded editorial pass with actual draft text and localized feedback. Its published result is not a promised improvement for this app or current models. |
| [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798), Huang et al., ICLR 2024 | In its reasoning experiments, intrinsic self-correction without external feedback could fail or degrade answers. | Do not rely solely on “check your work.” Supply sources and independent checks. This paper does not prove editing prose is ineffective. |
| [Assertion-evidence approach](https://www.assertion-evidence.org/), Penn State communication educators; [underlying comprehension study](https://www.writing.engr.psu.edu/ae_comprehension.pdf), Garner and Alley, 2013 | Technical presentation research emphasizes messages supported by visual evidence rather than inventories of topics. | Give each slide a clear supported message and explain its evidence. Adapting this to generated speech is a design inference; these studies are not tests of teleprompter AI. |
| [What? So what? Now what?](https://www.gsb.stanford.edu/insights/one-communication-tool-you-should-add-your-toolkit), Matt Abrahams, Stanford GSB, 2016 | Communication structure should connect an idea to audience relevance and a next step. | Use a structure when the talk needs it; do not force its three beats onto every slide. Indexed primary-source text was available; direct page retrieval returned 403. |
| [Silence Is Golden](https://toastmasters.org/magazine/magazine-issues/2019/july/silence-is-golden), Bill Brown, Toastmasters, July 2019 | Pauses can support reflection, interaction, emphasis, and transitions; their placement matters. | Make guidance purposeful and sparse. This is practitioner advice, not an empirical validation of the current voting scheme. |

OpenAI documentation was fetched through the official docs tool and cross-checked with Context7. Non-OpenAI research used primary papers and institution/author sources. Older research is used for principles and limitations, not as a benchmark of `gpt-5.4-mini`.

## Proposed quality process

Preserve the application's simple import-to-draft journey. These are internal processing changes, not a required questionnaire.

1. **Build a source packet.** Keep essential facts, units, qualifiers, uncertain visual observations, and source IDs. Separate extracted/verified material from inferred narrative context.
2. **Make a content plan.** Record each slide's job, takeaway, essential points, terms already explained, and a sensible word range. Preserve the user's goal and exclusions.
3. **Draft efficiently.** Continue bounded batches, carrying the shared voice and compact content map. Use relevant, source-faithful demonstrations. Full script is a distinct mode.
4. **Check the actual prose.** Run cheap diagnostics and factual/coverage checks. Feed localized problems and actual neighboring text into one editor pass. Keep unaffected slides intact.
5. **Accept on evidence.** Hard checks protect source fidelity and essential coverage. A calibrated comparison assesses phrasing/flow. Time fit cannot override factual correctness.
6. **Generate minimal guidance.** Run delivery on final prose, with precise example-calibrated criteria and enforced spacing. No guidance is an acceptable outcome.
7. **Save with provenance.** Record prompt/model versions, stage results, accepted repairs, fallback mode, latency, and usage. Keep ordinary production logs free of private deck/script content; curate consented/sanitized examples for evaluation.

A quality gate should distinguish hard failures from editable warnings. Invalid IDs and unsupported critical claims cannot be labeled a successful complete draft. Soft issues can preserve a useful draft while clearly retaining a private review diagnostic.

## Candidate writing guide and coaching guide

- [Speechwriting guide v2](speechwriting-guide-v2.md): explicit priorities, grounded demonstrations, different depth modes, and a localized editor contract.
- [Delivery guide v2](delivery-guide-v2.md): sentence-level coaching calibration and required selector changes.

The guide is a stable, small instruction package. Select relevant demonstrations by slide type. A large skill catalog, retrieval system, hosted-shell workflow, or general multi-agent runtime is unnecessary for this narrow feature at this stage.

If a presenter supplies a short sample of their own speech, derive a modest style profile such as formality, pronoun choice, sentence rhythm, and terminology. Do not add sample facts to the deck. Make this optional: the default draft must still work without extra setup. Without such a sample or user preference, the current promise of sounding like the presenter is a generic voice target, not personalization.

## Experiment plan

### Dataset and baseline

Start with 12 curated, consented or synthetic decks: six development decks and six held-out decks. Include engineering status, decision pitch, teaching, chart-heavy evidence, technical diagrams, scanned PDF/image-only content, sparse dividers, dense tables, future-versus-completed work, uncertain visual labels, short/long timing requests, and all depth modes. Expand before broad release. Keep held-out examples out of prompt demonstrations.

Run the current code as baseline, with a recorded model snapshot and explicit settings. The documented mini snapshot is `gpt-5.4-mini-2026-03-17`; verify intended account eligibility before replacing an eligible alias. Record commit, prompt hash/version, source revision, full request settings, analysis quality, accepted retries, actual provider usage, and per-stage latency. Do not infer usage from word counts.

### Isolate the intervention

| Variant | Change relative to its stated baseline | Question |
| --- | --- | --- |
| A | Current prompts and pipeline | What does the exact current implementation produce? |
| B | Corrected guide/demonstrations only; same model, effort, and data | Does clearer instruction improve naturalness? |
| C | B plus a source-aware, actual-draft editorial pass | Does editing improve the script beyond B? |
| D | B plus medium reasoning for the writer only | Does more reasoning help enough to justify latency/usage? |
| E | B with full `gpt-5.4` for writing only, if available and budgeted | Is model capacity limiting the result? |
| F | Best measured script variant; delivery calibration/spacing only | Does advice improve independently of prose? |

Keep model changes separate from prompt changes. Start with one run per development deck for smoke evaluation, then repeat promising variants three times and evaluate held-out decks. Cap request output and aggregate experiment usage; the present provider does not persist `response.usage` or set an explicit `max_output_tokens`, so add measurement/bounds before a large sweep. Account for retries and the three delivery reads.

The cost-effective hypothesis to test is that one stronger writing/editorial pass provides more value than three full-model coaching reads. It is not a measured conclusion. Do not switch the production default on this audit alone.

### Rubric and acceptance

Score each dimension separately, with concrete examples and 1–5 anchors:

| Dimension | Low score | High score |
| --- | --- | --- |
| Spoken naturalness | Awkward clauses, label-reading, repeated framing, difficult to say aloud | Comfortable phrasing and varied rhythm; a person can deliver it with minimal editing |
| Listener clarity | Dense inventories, unexplained terms, vague pronouns | Main point and relationships understood on one hearing |
| Narrative coherence | Repeated claims, discontinuous handoffs, inconsistent terms/viewpoint | Each slide advances the talk; actual boundaries connect |
| Fidelity and coverage | Invented or misattributed facts; changed units/status; missed required points | Essential claims trace to sources with intact qualifiers and uncertainty |
| Useful depth and timing | Filler, compressed fragments, timing fit achieved by losing meaning | Appropriate explanation within measured overall delivery time |
| Delivery usefulness | Distracting pauses; irrelevant emphasis; slow marks mask bad sentences | Sparse guidance tied to actual listener needs and comfortable flow |

For pairwise comparison, randomize left/right order, conceal model/prompt names, allow ties, and ask why one version is easier to deliver. Use human read-aloud checks on a representative subset; count required edits and observe comprehension. Calibrate any model judge against those labels and test for position/verbosity bias. A judge is an aid, not an objective certification.

Proposed initial product gates, to validate with the owner:

- No unresolved invalid IDs or critical unsupported claims in the release evaluation set.
- Required source points retained, with explicit handling of unreadable/missing evidence.
- A clear preference improvement for naturalness and delivery usefulness over A, without a fidelity regression. A provisional target is at least 65% wins among non-ties; report sample size and uncertainty rather than claiming significance from a small pilot.
- Median human naturalness at least 4/5 on held-out examples, with poor cases individually reviewed rather than hidden by an average.
- Zero unapproved cue-spacing violations; guidance can be absent on suitable slides.
- Report p50/p95 latency, actual total tokens, fallback rates, and failure rates alongside quality. Timing checks include pauses and slide changes.

These thresholds are proposed acceptance targets, not scientific constants or results already achieved.

## Implementation order

1. **Make quality measurable:** add provenance/usage, representative examples, and the spoken/fidelity/coaching rubric. Preserve an exact baseline.
2. **Fix demonstrated contradictions and integrity gaps:** reconcile examples/rules, separate depth modes, enforce ID matching, and stop treating raw numeric occurrence as full grounding. Test stricter cue cadence separately as a quality hypothesis.
3. **Improve writing acceptance:** include the actual draft in repairs, preserve hard source/coverage requirements, and add bounded editorial review of actual neighboring scripts.
4. **Tune the writer:** compare the candidate guide, reasoning level, and full-size writer separately. Choose based on judged quality and measured resource use.
5. **Tune coaching:** calibrate purpose-based advice, measure cue precision, and test whether fewer model reads can preserve or improve usefulness.
6. **Expand evaluation:** multimodal and real-user cases, optional voice personalization, and regression checks before changing prompts again.

This work is focused on making the script the strongest feature. Authentication, storage migration, landing-page work, and unrelated UI changes are outside this audit.

## Reproducing the local evidence

From the repository root:

```powershell
npm test
node --import tsx outputs/script-quality-audit/probes.ts
```

The probe reads existing reports and invokes pure local validators; it does not read `.env.local`, call a provider, or upload content. It writes `evidence.json`. Its historical sentence metrics use the application's sentence splitter after removing report formatting. They are heuristic diagnostics.

AI assistance: Codex performed the code audit, documentation research, offline probes, and candidate guide/report drafting. The candidate guides need comparative evaluation and human read-aloud validation before any claim of improved generated quality.
