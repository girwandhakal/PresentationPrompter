# Script quality implementation and experiment record

2026-09-27. Baseline: `eec88cee706d7612bfce1910f51b11f8e8063986`. Implementation: branch `codex/script-quality-pipeline`. Current runtime guide: `speech-2.3.0`.

The current writing pipeline generates from the slides using a factual priority order, relevant examples, and separate full/notes/cue instructions. User feedback clarified that the problem is how slides are paraphrased, especially routine change lists, rather than false claims. `speech-2.3.0` therefore teaches grouped spoken summaries with audience-relevant highlights. Routine generation and rewrites no longer call a model source reviewer or editor. Local checks provide private advice and cannot block a usable draft; malformed identity or empty output still fails. The experimental editorial path also retains drafts with unresolved notes rather than withholding them.

The historical study below measured the earlier full-size writer plus blocking review profile. Those results do **not** validate the current prompt-only profile or establish a flawless pipeline. The final sweep was stopped at the user's spending objection. No further paid experiments are authorized. The new paraphrasing instructions have only local verification so far.

## Earlier audit implementation, before the user's workflow correction

This table records the implementation evaluated in the study, including the blocking policy since removed. It is historical evidence, not the current generation sequence.

| Audit finding | Implementation and evidence |
| --- | --- |
| Dense speech passed narrow lint | Long-sentence and clipped-speech warnings inform the editor. The semantic review checks repetition, clause piles and listener clarity; length alone never certifies quality. |
| Conflicting rules/examples | Versioned runtime writing guide prioritizes fidelity, essential coverage, comprehension, voice, then timing. Examples preserve status and causal limits. A chart example now uses “by week six” rather than an ambiguous elapsed duration. |
| Notes/cues treated as speech | Mode-specific guides and lint preserve fragments and short anchors. Cue planning does not inflate anchors into full speeches. |
| Planned boundaries differed from actual speech | Editorial sections see actual adjacent prose, neighbor source packets and a compact content map. Edited decks receive a final boundary verification. Transition metadata is an alternative support line. |
| Weak factual grounding | Sources retain IDs, original statements, normalized quantities and visual uncertainty. Timing, inferred goals, narrative plans and voice samples are excluded from evidence. Source review checks entities, status, scope, units and causality; image-heavy/uncertain slides include original images. |
| Repairs could be worse | Editor receives the actual rejected draft and localized feedback. Hard source errors must clear; stylistic changes require preference without additional issues. Mixed accepted/retained sections are reviewed again. Unresolved errors block saving and preserve existing scripts. |
| Word targets encouraged filler | Forced fit expansion was removed. Thin title/divider slides receive short allocations, with time redistributed to richer slides. Unsupported duration is a private diagnostic rather than a request to invent prose. |
| Cue cadence hypothesis | Experimental conservative cadence exists in the harness. Current spacing is retained because the human comparison has not been completed. |
| Coaching voting/identity | Calibrated instructions distinguish essential comparisons and definitions from incidental inventories. Exact slide IDs and sentence numbers are required. AI/fallback/none status is retained. Three reads remain pending coaching evidence. |
| Proxy-only evaluation | Twelve curated decks, including actual image-only charts, development/held-out separation, counterbalanced blinded model comparisons, exact error spans, failure rates, latency and usage. A human read-aloud packet is generated locally; no human ratings have been collected. |
| Wrong-slide attachment | Analysis, outline, writing, editing and delivery reject missing, duplicate and foreign IDs rather than substituting position. |

Optional voice samples are style references only. Concurrent user edits are detected before the generated draft is saved. Old/new versions remain reversible. Private review notes and generation telemetry are retained in the project, without logging presentation content on the server.

Source packets are structured evidence for a reviewer, not an exhaustive claim graph or proof. Quantity normalization is unit-aware but cannot verify entity relationships or every valid calculation. Both deterministic checks and the model reviewer can make mistakes.

## Completed comparisons

Shared preparation used the frozen baseline's analysis/context/outline and identical slide inputs. A–E retained the baseline retry and fit policies to isolate the guide, reasoning and writer-model interventions. Review used curated required points in addition to source text. This helps isolate writing quality; production outlines infer required points and were not validated by this study to the same standard.

| Development variant (6 decks, one run each) | Consistent wins / losses | Order-sensitive | Completed / attempted |
| --- | --- | --- | --- |
| B: corrected guide | 2 / 1 | 3 | 6 / 6 |
| C: guide + mini review/edit | 3 / 0 | 3 | 6 / 6 |
| D: guide + medium writer reasoning | 1 / 2 | 3 | 6 / 6 |
| E: guide + full-size writer | 3 / 1 | 2 | 6 / 6 |
| J: full-size writer/reviewer, bounded edit, no forced fit | 6 / 0 | 0 | 6 / 6 |

G/H/K were development iterations with too many rejections (3 of 6 each). These exposed overly literal source checking and inferred narrative being mistaken for evidence. They are retained in the result summary, not discarded as inconvenient runs.

The frozen primary J study used six held-out decks with three runs each:

- 15 of 18 generations completed; three were rejected by the source gate.
- Of 15 completed paired comparisons, J won in both presentation orders on 13. Two were order-sensitive. There were no consistent losses or ties.
- Median **model-predicted** naturalness was 4/5 and fidelity 5/5. These are not human ratings.
- One judge flagged an essential omission: the spoken review plan did not state that no owner/deadline was supplied. Private metadata had incorrectly been treated as coverage. The updated reviewer requires explicit essential points in audience-facing paragraphs/notes/cues.
- Generation latency: J p50 26.76 seconds, p95 34.362; A p50 8.859, p95 15.412. This excludes shared analysis/planning, delivery and judges, and covers three-slide fixtures, not whole production decks.
- Generation tokens: J 228,601; A 114,910. Review improves source control but adds cost and latency. Full-size models are independently configurable.

The rejections include an unsupported recommendation to approve a pending pilot, an unsupported explanation of staffing causes from a queue chart, and a valid three-day observation count rejected by the numeric diagnostic. The last case motivated a narrow consecutive-day count rule, which excludes uncertain visual labels. These examples are not proof that all source errors will be caught.

L (`speech-2.2.0`) added original image review, audible essential coverage and day-count handling. Its development sweep was interrupted after eight saved attempts: seven completed and one rejected. Seven completed comparisons favored L in both orders. No L held-out runs completed. These incomplete results cannot replace the primary J study. The current `speech-2.2.1` and local cross-slide quantity fix have local regression coverage, but no new live-model validation.

Preliminary coaching outputs exist on six development decks, comparing original three reads, calibrated one/three reads and rule fallback. Preference judges and human read-aloud calibration were **not completed**. There is no demonstrated coaching gain or basis to change spacing, unanimity or read count yet.

## Spending and reproducibility

The main experiment ledger recorded **1,420,101 input plus output tokens** when stopped. A separate initial pilot recorded 22,418, totaling 1,442,519 recorded tokens across those two experiment roots. This is not an account-wide usage total or verified dollar bill; requests interrupted in flight may have incomplete telemetry. Reasoning tokens are included in output, not added a second time. Cached inputs are recorded separately. Full raw outputs remain in ignored local `outputs/` directories; the checked-in [result summary](script-quality-results.json) retains completed, rejected and order-sensitive results.

Paid scripts now fail before sending requests unless explicitly enabled and scoped. Evaluation requires a named deck and positive token cap; comparison experiments additionally require named variants. Every SDK request reserves input plus maximum output before dispatch, including parallel judges and delivery reads. Tokens are not dollars: model rates and cache discounts differ. Agree on a monetary spending limit before any future paid run; an API key's presence is not permission to spend it.

No API calls are needed for these commands:

```text
npm run check
npm run eval:report
npm run eval:baseline
```

`eval:baseline` reconstructs the audited Git revision and adds only measurement, output caps and explicit experiment knobs. `eval:report` reads saved local results and writes a blinded read-aloud packet plus a separate answer key. The packet includes original source/essential points and available images. Saved outputs are required to reproduce the exact summary; they are not downloaded by the command. Fixture hashes, prompt hashes, model snapshots, effort, usage and timings are recorded in the raw trials. Early baseline measurements lack instruction hashes; baseline revision/archive identifies those instructions. Development source hashes captured during editing are weaker provenance than the actual call's instruction hash.

## Validation and remaining work

`npm run check` passed after the workflow correction: lint, typecheck, all 78 unit/API tests, and the production build. Regressions cover retaining all four drafts when four concerns are reported, unavailable-review fallback without another edit call, change-summary example selection versus ordered-step treatment, local rewrite advice, and identity/empty-output checks. Earlier diagnostic handling preserved detailed source-check responses, but normal generation no longer produces those blocking errors. Earlier failed attempts discarded their reasons and cannot be reconstructed from a generic count. Both paid evaluation commands were verified to refuse an unscoped invocation before any API request. Baseline reconstruction and saved-result reporting succeeded locally. Browser journeys use the deterministic demo provider and therefore consume no API credits.

The study uses small synthetic three-slide fixtures, model judges and curated essentials. It lacks real-speaker recordings, unreadable-chart/OCR stress coverage, independent human fidelity ratings and a completed end-to-end production-model trial. Image judging was strengthened after the initial development sweep, so early image-only comparisons have weaker evidence. No statistical significance or production error rate is claimed. Rejections must be reported alongside preferences; comparing only accepted prose otherwise hides failures.

Next validation, when budget and participants are agreed: score the existing blind packet aloud without any API call; inspect poor/rejected spans; complete coaching calibration; then run a small fixed-budget production-profile confirmation on new held-out and unreadable-visual cases. No further model calls should be made merely to improve an average or obtain a cleaner success story.
