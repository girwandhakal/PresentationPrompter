# PresentationPrompter Product Overview

## Change log

| Date | Requirements added or updated |
| --- | --- |
| 2026-09-26 | Added deployment requirements, a public landing page with login/signup, OAuth accounts and security controls, persistent database and private bucket storage, account admission and enforceable usage limits, and a researched backend recommendation. Calculated a provisional five-user/five-generations-per-day budget against the owner-reported 2.5 million complimentary OpenAI tokens per day. Updated the core journey so import generates a script automatically with optional setup, and added launch acceptance criteria and research sources. |
| 2026-09-27 | Selected the pilot stack: Vercel hosts the Next.js app; Firebase provides Authentication (Google sign-in), Cloud Firestore, and Cloud Storage. Replaced the Cloudflare/Supabase recommendation, PostgreSQL row-level security, and Cloudflare Queues with Firebase Security Rules, direct SDK uploads, and Vercel-hosted durable jobs. An AWS (Cognito/S3/DynamoDB) alternative was evaluated the same day and rejected in favor of Firebase's built-in Security Rules and local emulator. Raised the pilot to ten accounts with a shared, first-come app-wide token cap. Removed backup and restore from pilot scope. Added a $0 cost plan and updated acceptance criteria, open decisions, and research sources. |

**Status:** Product direction and working requirements
**Working product name:** PresentationPrompter
**Current application name in the codebase:** Cueframe
**Audience:** Product, design, engineering, and AI implementation contributors

## 1. Executive summary

PresentationPrompter is a private, slide-aware presentation companion for people who want to present clearly without performing an extroverted version of themselves. It combines three things:

1. Presentation playback for an existing deck.
2. A synchronized teleprompter with a readable, low-distraction speaker interface.
3. An AI presentation coach that generates a script and offers visual, timing, delivery, and recovery cues.

The product is designed especially for introverted presenters: people who prefer preparation, thoughtful pacing, lower stimulation, and a reliable private support system when speaking in front of others. It should help users sound like themselves with more confidence; it should not pressure them to become louder, faster, more theatrical, or more performative.

The product is not intended to replace PowerPoint, Keynote, or Google Slides as a full presentation editor. Users bring a presentation they already made. PresentationPrompter understands the imported slides, creates a presentation-ready script, and gives the presenter a private view while the audience sees only the slides.

The core promise is:

> Bring the presentation you already made. Get a clear script, helpful visual cues, and a private presenter view that helps you deliver it naturally.

The deployed release must be a full-stack application with authenticated user accounts, persistent private projects, and server-enforced resource limits. A public landing page introduces the product and offers login and signup; authenticated users enter their own presentation workspace. The first script is generated automatically after a valid import, using inferred context and sensible defaults. Final pilot limits remain configurable and subject to owner confirmation and measured usage.

## 2. Product thesis

Most presentation tools optimize for creating attractive slides. Most teleprompters optimize for scrolling text. PresentationPrompter should optimize for the moment between the two: helping a person move through visual information while speaking in a natural, human way.

The product's differentiation is not simply that it can generate speaker notes. The differentiation is that it understands the relationship between:

- what is visible on the current slide;
- what the presenter should say;
- what the presenter should emphasize;
- where the presenter should look or gesture;
- how much time remains;
- what happens next in the deck; and
- how the presenter can recover if they lose their place.

The experience should feel like a calm private co-pilot, not a sales funnel, a generic chatbot, or a robotic reading exercise.

## 3. Target users

### Primary audience: introverted presenters

The primary user is an introvert or low-stimulation presenter who may:

- prepare carefully but still lose their place while presenting;
- know the material but struggle to retrieve the right wording under pressure;
- prefer a conversational, thoughtful delivery style;
- dislike memorizing a script word-for-word;
- want private assistance without making their notes visible to the audience;
- need help turning dense slides into a simple spoken narrative;
- worry about transitions, timing, or blanking on a key point; and
- want to rehearse alone before presenting to a group.

Introversion is not a deficit that the product needs to correct. The product should respect a quieter communication style and reduce unnecessary cognitive load.

### Secondary audiences

The same product can support:

- founders and executives preparing investor or board presentations;
- sales and customer-success professionals running demos or updates;
- educators and trainers teaching from visual materials;
- researchers explaining technical findings;
- non-native speakers who want more natural phrasing and pacing support;
- presenters who experience public-speaking anxiety; and
- people who present infrequently and do not have a practiced delivery routine.

The product should not assume that every user wants a complete script. Some users will prefer concise notes and cues. The interface should support a spectrum from lightweight prompts to detailed teleprompter text.

## 4. User problem

An existing presentation usually contains visual structure but not enough spoken guidance. A presenter must simultaneously:

- interpret the slide;
- remember the intended narrative;
- phrase the explanation naturally;
- watch time;
- decide when to advance;
- maintain eye contact;
- respond to audience reactions; and
- recover when attention or memory breaks.

This is a high-load task, especially for people who are thoughtful rather than improvisational presenters. Standard speaker notes are often hidden behind the presentation software, too small to read, or disconnected from the current slide. A standalone teleprompter does not know what is on the slide and cannot guide transitions.

PresentationPrompter should reduce that load by placing the right information in front of the presenter at the right moment.

## 5. Product principles

### 5.1 Support the user's real voice

Generated scripts should sound speakable, not written. The user should be able to adjust tone, complexity, directness, and level of detail. The product should help the presenter sound prepared without making them sound scripted.

### 5.2 Private by default

The speaker script, cues, timer, and AI assistance belong in a private presenter view. The audience-facing presentation should contain only the imported presentation content.

The product must clearly teach the safe workflow: share the presentation window, not the entire desktop and not the private presenter window.

### 5.3 Glanceable over exhaustive

The presenter should be able to glance at the current sentence or cue and return attention to the audience. Cues should be sparse by default. More detail can be available on demand, but the default experience should not feel like reading a wall of instructions.

### 5.4 Slide-aware, not merely text-aware

The AI should understand images, charts, diagrams, layout, emphasis, and visual hierarchy. Visual analysis should improve the script and delivery cues, not produce decorative summaries that do not help the presenter.

### 5.5 Calm instead of gamified

The product should use quiet visual design, stable layout, predictable controls, low-noise notifications, and minimal animation. It should reduce presentation anxiety rather than add another dashboard to manage.

### 5.6 The presenter stays in control

AI suggestions are drafts and coaching options. The user can accept, edit, reject, hide, or regenerate them. Nothing should silently change the spoken script during a live presentation.

### 5.7 Be honest about uncertainty

If the system cannot read a chart, identify an image, or infer the intended meaning of a slide, it should say so. It should not invent a claim or present an uncertain visual interpretation as fact.

## 6. Core product loop

~~~text
Import an existing presentation
        ->
Understand slides and extract content
        ->
Infer context and apply saved preferences or sensible defaults
        ->
Automatically generate a slide-aware script and cues
        ->
Review and edit in the teleprompter script editor
        ->
Practice or present with synchronized slides and teleprompter
        ->
Present with the audience view separated from private support
~~~

Every surface should move the user through this loop. The public landing page leads to login or signup. The authenticated home screen is a functional workspace for importing and reopening presentations. Brief adjustments are optional and must not block the default first draft.

## 7. Primary user journey

### 7.1 Start a presentation session

The user creates a session or opens an existing one. A session contains:

- the imported source presentation;
- normalized slide images or renderable slide content;
- extracted text and visual descriptions;
- script versions;
- delivery cues;
- timing targets;
- presenter-session history; and
- user preferences for presenter mode.

The user should be able to switch between sessions without losing work.

### 7.2 Import an existing presentation

For the first release, keep import intentionally simple and dependable.

Supported inputs should include:

- plain PPTX or PowerPoint files;
- PDF presentations;
- individual slide images such as PNG or JPEG; and
- an ordered group of slide images where the user can confirm order.

Keynote should be supported through a PDF or image export initially rather than requiring a native Keynote parser. Other formats may be accepted only when they can be safely converted to a supported representation.

The initial import pipeline does not need to preserve:

- animations;
- slide transitions;
- builds or staged bullet reveals;
- embedded video playback;
- interactive links;
- editable shapes or text boxes; or
- full PowerPoint editing semantics.

The product should render a stable, plain visual version of each slide. If an animation affects the meaning of a slide, the import review should flag that limitation so the user can provide a static export or add context manually.

The import flow should show:

- file name and type;
- detected slide count;
- thumbnail preview;
- extraction status;
- slides that require OCR or visual review;
- unsupported content warnings; and
- a clear way to replace or reorder slides.

### 7.3 Configure the AI brief

The system should infer a brief from the imported deck and apply saved preferences or product defaults, then generate the first script automatically. The user may provide context or adjust settings, but no prompt, goal entry, or setup submission is required for the default path.

Automatically populated, editable fields:

- presentation goal;
- audience;
- target duration or time per slide;
- desired delivery style; and
- level of script detail.

Optional fields:

- the main idea the audience should remember;
- required facts, examples, or calls to action;
- technical terms that must remain unchanged;
- phrases or claims to avoid;
- the presenter's role and relationship to the audience;
- whether questions are expected; and
- whether the presenter wants a full script, concise notes, or cue-only guidance.

The AI should infer the likely presentation context from the imported slides, extracted text, deck structure, and visual content. It must treat that inference as a helpful starting point. The optional setup form lets the user state a goal in their own words, such as "persuade the team to approve this plan" or "help new students understand this method." A user-provided goal takes precedence over inferred context.

The user should be able to change the brief and regenerate without losing the prior version.

### 7.3.1 Optional session setup and automatic defaults

Script generation should begin automatically after import validation, account/quota admission, and any required first-use privacy consent. The system supplies duration, speaking rate, and support preferences without requiring the user to pass through a setup form. Optional setup exposes these constraints for users who want to change them. Reopening a presentation must reuse its existing draft rather than trigger another billable generation.

The form should be approachable for a first-time user, with sensible defaults and an **Advanced settings** area for people who want more control.

#### Session basics

- session or presentation title;
- presentation goal, with an editable AI suggestion derived from the imported deck;
- total presentation time;
- optional time reserved for questions;
- optional section or slide time targets; and
- whether the user wants the full deck included or wants to mark slides as optional.

#### Delivery profile

- speaking rate in words per minute;
- delivery style, such as conversational, concise, measured, energetic, technical, or executive;
- script depth: full script, concise notes, or cue-led prompts;
- cue density: none, light, or detailed;
- whether pauses and visual explanation time should be included in the plan; and
- whether the presenter expects to read closely or speak from prompts.

#### Narrative context

- the main point the audience should remember;
- audience and familiarity with the topic;
- presentation goal;
- required facts, examples, or calls to action;
- terms or claims to preserve; and
- topics or language to avoid.

#### Generation options

- generate the entire deck or selected slides;
- include visual delivery cues;
- include likely audience questions;
- include a short fallback version for each slide;
- create transitions between slides; and
- regenerate explicitly using the revised settings, preserving the existing draft.

The default first-run profile should be visible and editable without blocking generation. A reasonable starting profile is:

- 8-minute presentation;
- 130 words per minute;
- conversational and measured delivery;
- light cues;
- full script with concise fallback notes; and
- no dedicated Q&A time unless the user adds it.

These are product defaults, not fixed assumptions. The user should be able to save preferred values for future sessions and change the current brief through optional setup. Changing settings while a job is running must offer an explicit restart or apply them to the next generation, without silently launching duplicate jobs.

#### Word-budget planning

The generation planner should calculate a live estimate rather than treating duration as a decorative field. Optional setup exposes the same calculation.

~~~text
raw word budget = speaking rate (words per minute) x speaking time (minutes)
usable script budget = raw word budget - pause and visual explanation buffer
slide budget = usable script budget allocated across included slides
~~~

For example, an 8-minute session at 130 words per minute produces a raw budget of about 1,040 words. The product should reserve some of that time for pauses, slide transitions, chart explanation, audience reaction, and natural breathing. It should show the user an estimated usable range rather than pretending that every second should be filled with words.

The optional setup form should show:

- total target time;
- estimated speaking time after any Q&A reservation;
- selected speaking rate;
- estimated total words;
- approximate words per slide or section;
- slides likely to need more explanation; and
- a warning if the chosen settings are inconsistent, such as a very short duration with a full script for a large deck.

The system should allocate words intelligently. A title slide, chart, diagram, and dense content slide should not receive the same word count by default. The allocation can use slide complexity, user-marked importance, and section targets, but the user must be able to override it.

#### Optional setup review

When the user opens setup, show a compact review summary such as:

> 8 minutes total | 130 WPM | 6 minutes speaking and 2 minutes Q&A | approximately 650-750 spoken words after pauses | 12 slides | light visual cues

The user should be able to edit any value without losing their imported deck. An explicit **Regenerate script** action applies changed settings and shows that it uses the account's generation allowance. This summary is optional and does not gate the initial automatic draft.

#### Changing constraints after generation

If the user changes the duration or speaking rate after a script already exists, the product should not silently rewrite it. Offer explicit actions:

- **Rebalance script:** shorten or expand each slide to fit the new plan;
- **Update timing only:** recalculate estimates without changing wording;
- **Change presenter pace:** keep the wording and update teleprompter speed; or
- **Keep current draft:** save the new settings for the next generation.

The user should be able to compare the prior and proposed word counts before applying a rebalance.

### 7.4 Generate and review

The default import flow should automatically produce a complete first draft for the entire deck. The user should not need to understand prompting or AI terminology, enter additional details, or click a separate generate button.

Generation must use the resolved brief as an explicit constraint, whether its values come from defaults, saved preferences, inferred context, or optional user input. The generation request should include the target speaking time, Q&A reservation, speaking rate, usable word budget, slide or section allocations, script depth, cue density, delivery style, and any user-provided narrative context. The output should be checked against those constraints before it is shown as ready.

If the deck cannot fit the selected duration without losing important material, the system should flag the conflict and offer choices such as shortening the script, marking slides optional, increasing the duration, or raising the speaking rate. It should not silently produce an overlong script and claim that it fits.

Generation does not need to be observable. Do not expose token streaming, slide-by-slide stages, partial drafts, or a technical processing dashboard. Show a calm, simple generation state and clear recovery messaging only if generation fails or requires a user decision. When the complete, validated draft is ready, take the user to the dedicated teleprompter script editor.

Each slide should produce a structured result containing:

- slide purpose or main point;
- spoken script;
- optional concise version;
- transition into the slide;
- transition out of the slide;
- delivery cues;
- visual references;
- estimated speaking duration;
- confidence or review flags; and
- likely audience questions where useful.

The user must be able to edit the script directly in a dedicated teleprompter script editor. It should feel like preparing spoken delivery, not editing a chat response or a generic document.

### 7.5 Use Presenter mode for practice or live delivery

The user opens the same private Presenter mode whether they are practicing alone or delivering live. The product presents:

- the current slide;
- the current script block;
- the next-slide preview;
- elapsed and remaining time;
- slide progress;
- the current cue;
- manual navigation; and
- optional auto-scroll.

The Presenter mode records timing by slide and identifies slides that consistently run long, have too much text, or require a manual jump. Practice is a use of this mode, not a separate application mode or screen.

### 7.6 Present

Before the live session, the product should run a short preflight:

- confirm which window is audience-facing;
- confirm which window is private;
- show the current presentation title;
- confirm slide count and order;
- verify the presenter window is open;
- verify keyboard or clicker navigation if configured; and
- remind the user to share only the presentation window.

During the presentation, the user should be able to advance by:

- next and previous buttons;
- keyboard shortcuts;
- a remote clicker where supported; or
- a configurable speech or microphone interaction in a later phase.

### 7.7 Web-first synchronized-window workflow

The first release is a browser application. It should support the familiar two-window setup without requiring a desktop shell:

1. A private Presenter tab contains the teleprompter, cues, timer, slide previews, and controls.
2. An audience presentation window contains only the imported slides and is the window the user moves to an external display or shares in a meeting.

The user selects **Open audience presentation** from the private Presenter tab. That explicit click opens or reuses one named audience window, which avoids unnecessary windows and works with normal browser popup protections. The two app-owned views remain synchronized: moving through the script, clicking next or previous, pausing, jumping to a slide, or ending the session updates both views immediately.

The browser app controls only its own Presenter and audience views; it does not attempt to control arbitrary tabs, browser chrome, or another application. The user chooses where the audience window appears by moving it to the appropriate display. The product must not promise automatic monitor selection or private-window capture protection that browsers cannot guarantee.

If the browser blocks the audience window, the private Presenter tab must show a clear retry action and explain that the audience window must be opened from that action. The presentation remains usable from the private tab until the user completes the two-window setup.

## 8. Presentation import and playback

### 8.1 Normalized slide model

Every imported presentation should be normalized into an ordered list of slide records. A slide record should support:

- stable slide ID;
- original position;
- source file reference;
- rendered image or visual representation;
- extracted text;
- OCR text where applicable;
- visual analysis;
- import warnings;
- speaker script versions; and
- timing and cue data.

The source presentation should remain available for reprocessing if extraction improves.

### 8.2 Switching between presentations

The user should be able to:

- create more than one presentation session;
- reopen a previous session;
- switch sessions without losing the current script;
- duplicate a session for a different audience or tone;
- import a replacement version of the same deck; and
- preserve script and cue edits when slide identity can be matched safely.

When a replacement deck changes slide order or content, the product should show a review step rather than silently attaching old notes to the wrong slides.

### 8.3 Playback scope

The first playback experience can be a stable slide viewer rather than a full presentation engine. The main requirements are:

- high-quality static slide rendering;
- predictable next and previous navigation;
- correct aspect ratio;
- fullscreen or presentation-window mode;
- slide counter and progress;
- support for multiple displays where possible; and
- a private presenter window that stays synchronized.

Animations and transitions are explicitly out of scope for the first version. The product should make this limitation visible rather than implying that an imported PowerPoint will behave exactly like PowerPoint.

## 9. Teleprompter experience

The teleprompter is a primary product surface, not a secondary text box.

### 9.1 Layout

The default presenter view should show:

- current slide or a compact slide context;
- current script text;
- the next slide title or preview;
- current slide number and total slides;
- elapsed time and target time;
- progress through the current slide;
- the next meaningful cue; and
- controls for play, pause, navigation, and reset.

The interface should support a distraction-free mode that hides secondary controls while keeping emergency navigation available.

### 9.2 Reading modes

The product should support multiple ways to follow the script:

- manual scroll;
- smooth auto-scroll;
- sentence-by-sentence progression;
- cue-to-cue progression;
- pause at slide transitions;
- large-text glance mode;
- concise notes mode; and
- a pace-linked mode that derives auto-scroll speed from the session's speaking-rate target.

Auto-scroll should be smooth and stable. It must not jump unexpectedly when the user changes font size, window size, cue visibility, or reading width. The user should be able to adjust the calculated pace while using Presenter mode without changing the script's word budget.

The product should support a short speaking-rate calibration inside Presenter mode. The user reads a sample passage for a few seconds, and the product suggests a personal pace. The user must approve that pace before it becomes a saved default.

### 9.3 Slide synchronization

Slide and script state must be treated as a shared state machine. At minimum, the state should include:

- active presentation;
- active slide;
- active script block or sentence;
- playback state;
- scroll position;
- elapsed time;
- target duration;
- target speaking rate;
- planned word budget;
- current estimated words remaining;
- navigation source; and
- whether the user is manually overriding automation.

Navigation behavior should be explicit and predictable:

1. If the user clicks next slide, the presentation and private presenter view advance together.
2. If the user clicks previous slide, both views return to the previous slide and the teleprompter resets to that slide's starting position.
3. If auto-scroll reaches the end of the current slide's script, the product advances to the next slide when automatic advancement is enabled.
4. If the user manually scrolls backward or pauses, automatic advancement should yield to the user until they resume.
5. If the final slide completes, the product stops and shows a completion state rather than looping unexpectedly.
6. The user can disable automatic advancement and require an explicit next action.

The system should include a short transition guard so a script that ends early does not immediately advance because of a small scroll or rendering error. The presenter should always be able to cancel or undo an automatic advance.

### 9.4 Navigation and recovery

The user should be able to:

- jump directly to any slide;
- replay the current slide;
- skip a slide temporarily;
- return to the last cue;
- pause the timer without losing position;
- restart the current slide or full session;
- show a short fallback script;
- reveal the next transition early; and
- mark a slide for later review during a presenter session.

Recovery is particularly important for the target audience. A private button such as "I lost my place" can show the current slide's main point, the first sentence, and a safe transition without making the presenter search through the full script.

### 9.5 Presenter controls

Controls should be usable with a keyboard, mouse, touch input, and a remote clicker where the operating system exposes it.

Suggested defaults:

- Space: play or pause teleprompter;
- Right arrow: next slide;
- Left arrow: previous slide;
- Home: restart current slide;
- End: jump to the end of the current script;
- Escape: exit presenter mode;
- a configurable key: show recovery prompt; and
- a configurable key: hide or reveal cues.

The user should be able to customize shortcuts without changing the core layout.

### 9.6 Personalization

Teleprompter settings should include:

- font size;
- line height;
- reading width;
- scroll speed;
- contrast mode;
- focus line or eye-line guide;
- cue density;
- mirror mode for a physical teleprompter setup;
- current-slide context visibility;
- next-slide preview visibility; and
- reduced-motion mode.

Settings should be stored per user or per presentation, with sensible defaults for first-time users.

## 10. Teleprompter script editor

The teleprompter script editor is a separate interface entered after generation. It is the place where the user turns a complete AI draft into a script they can comfortably deliver. Optional setup remains accessible from the project workspace; the editor does not need to expose the generation process.

### 10.1 Default generation

The first action should be simple: the signed-in user imports a supported deck and receives a complete slide-by-slide draft automatically. The system infers context, applies defaults, checks quota, and handles analysis and writing internally. Optional brief changes and targeted rewrites improve the draft afterward; they are not prerequisites for a usable script.

The generation request should use:

- imported slide text;
- slide images or visual descriptions;
- deck outline;
- inferred presentation context and any user-stated presentation goal;
- target duration and any Q&A reservation;
- target speaking rate;
- usable word budget and slide allocations;
- desired tone; and
- the user's preferred detail level.

### 10.2 Teleprompter-specific editing

The editor should be optimized for reading aloud and synchronizing with slides. It must provide a slide navigator and preview, with the selected slide's script in the main editing area. A user should be able to move through the deck without losing edits or their place.

Core teleprompter editing tools should include:

- live spoken-duration and word-count estimates for the current slide and total presentation;
- speaker-friendly line wrapping and adjustable reading width, font size, and line spacing;
- explicit pause, emphasis, pronunciation, and beat markers that render correctly in Presenter mode but do not appear to the audience;
- insertion and editing of visual, delivery, and recovery cues at precise points in the script;
- split, merge, reorder, and label script blocks within a slide;
- a short fallback version and cue-only version alongside the full script;
- quick conversion between full script, concise notes, and keyword prompts without losing the canonical full script;
- per-slide target time, optional-slide status, and a visible over/under-time warning;
- direct preview of how the current block will look and scroll in Presenter mode; and
- keyboard-first editing, undo/redo, and quiet autosave.

Users should be able to edit:

- the main spoken script;
- transitions;
- cue text;
- timing target;
- slide purpose;
- short fallback version;
- audience question preparation; and
- teleprompter markers and reading breaks.

The editor should provide focused text-selection actions without becoming a chat interface. Edits should autosave to the authenticated user's project store, with a local recovery cache for interrupted connectivity. Saving status should distinguish saved cloud data from pending local changes and remain quiet.

### 10.3 Targeted AI actions

The user should be able to select a slide, paragraph, sentence, or cue and request a focused change. Useful actions include:

- make this more conversational;
- make this less sales-oriented;
- shorten by 15 or 30 seconds;
- expand the explanation of this chart;
- use simpler language;
- make the transition clearer;
- add a concrete example;
- preserve the technical terms but simplify the sentence;
- create a concise notes version;
- create a recovery line; and
- generate likely audience questions.

Targeted actions should not rewrite the entire deck unless the user explicitly asks for that.

### 10.4 Versioning and trust

The product should preserve enough history for the user to undo a generation or compare versions. At minimum:

- undo and redo for direct edits;
- restore the previous generated draft;
- show which text was AI-generated and which was user-edited where practical; and
- warn before replacing substantial user edits.

The system should never silently overwrite a user's script with a regenerated version.

## 11. Multimodal visual coaching

One of the main differentiators is an AI image model that analyzes the presentation visually and gives delivery guidance connected to what the audience sees.

### 11.1 What the visual model should analyze

For each slide, the model may analyze:

- visible text and hierarchy;
- charts and data relationships;
- diagrams and process flows;
- tables and metrics;
- photos and people;
- product screenshots;
- callouts and highlighted regions;
- spatial layout;
- visual contrast and emphasis; and
- likely audience attention points.

Text extraction and image analysis should be combined. The model should not rely on a screenshot alone when machine-readable text is available, and it should not rely on extracted text when meaning depends on a chart or image.

### 11.2 Cue types

Visual coaching can produce structured cues such as:

- **Look at this:** direct attention to a chart, number, image, or highlighted area.
- **Gesture here:** suggest a small, natural gesture toward a region or transition.
- **Say this:** suggest a plain-language explanation of a visual element.
- **Emphasize:** slow down or stress a specific number, contrast, or phrase.
- **Pause:** give the audience time to absorb a dense visual.
- **Compare:** explain a before-and-after or two-column relationship.
- **Trace:** guide the presenter through a process or diagram in order.
- **Do not read:** remind the presenter not to repeat visible text verbatim.
- **Transition:** connect the visual conclusion to the next slide.
- **Audience check:** suggest a question or comprehension check when appropriate.
- **Caution:** flag a chart or claim that may require context.

Cues should refer to observable slide content. For example:

> Point to the rightmost bar as you explain the increase from Q2 to Q3.

This is better than a generic cue such as "use a confident gesture."

### 11.3 Cue quality requirements

The visual coach should:

- provide a reason for each cue;
- cite the slide region or visible element that prompted it;
- distinguish observation from inference;
- assign a confidence or review state;
- avoid suggesting gestures that are unnatural or unsafe;
- avoid excessive cues;
- avoid treating decorative imagery as meaningful evidence; and
- allow the user to accept, edit, hide, or delete every cue.

If the model is uncertain, the UI should say something like:

> Possible chart cue - verify that the highlighted series is the intended focus.

### 11.4 Cue density

The default should be one to three high-value cues per slide. A user can choose:

- script only;
- light cues;
- detailed coaching; or
- visual analysis review mode.

Detailed coaching should be available when the user is practicing in Presenter mode. During a live session, the same mode should prioritize only the next cue or the current cue.

### 11.5 AI output shape

The AI should return structured data rather than unstructured prose. A conceptual representation is:

~~~text
Presentation
  Slide
    source content
    visual observations
    main point
    script blocks
      spoken text
      estimated duration
      cue type
      cue text
      referenced region
      confidence
    transition
    short version
    audience questions
    review flags
~~~

This structure makes it possible to render cues in the teleprompter script editor, Presenter mode, presenter-session analytics, and future exports without regenerating the entire response.

## 12. Introvert-focused assistance beyond a regular teleprompter

The product should provide more than scrolling words. The following features are strong candidates for differentiation.

### 12.1 Calm start

Before presenting, offer a short private start sequence:

- verify the correct window is shared;
- show the first slide and first sentence;
- show the target duration;
- provide an optional breathing or pause reminder;
- let the user delay the start by a few seconds; and
- keep the interface quiet until the user is ready.

This should be optional and framed as a practical reset, not medical or therapeutic advice.

### 12.2 Private recovery mode

When the presenter loses their place, a recovery control should surface:

- the current slide's main point;
- the last completed idea;
- the next sentence;
- a short bridge phrase; and
- an option to pause or go back.

The recovery experience should be faster than scanning the entire script.

### 12.3 Flexible script depth

Users should be able to switch while practicing in Presenter mode between:

- full script;
- paragraph prompts;
- bullet notes;
- keywords only; and
- cues only.

This supports a progression from dependence on the teleprompter toward a more natural delivery style.

### 12.4 Time-pressure controls

Presenters often discover while using Presenter mode that they are running long. The product should provide:

- a remaining-time indicator;
- slide-level time budgets;
- a short version of each slide;
- a "compress for remaining time" action;
- a way to mark optional slides; and
- an explicit transition when a slide is skipped.

The system should not silently remove important claims. It should show what will be shortened or skipped before applying the change.

### 12.5 Audience question preparation

For each slide or section, AI can suggest:

- likely audience questions;
- concise answers;
- facts that should be verified before presenting;
- questions the presenter can ask the audience; and
- safe ways to say "I do not know yet."

This directly addresses a common source of presentation anxiety without forcing the user to create a separate FAQ document.

### 12.6 Delivery reflection

After a presenter session, provide constructive observations such as:

- this slide consistently ran long;
- the transition was skipped twice;
- the script contains more words than the available time supports;
- the presenter paused before the main point; or
- the user repeatedly returned to a slide.

Microphone-based pace analysis can be explored later, but it should require explicit permission and clear local data handling.

### 12.7 Low-stimulation interface

The product should avoid urgency-heavy dashboards, celebratory gamification, social comparison, and noisy alerts. Presenter-session progress can be useful, but it should not become a performance score that increases anxiety.

## 13. Privacy and sharing model

The safest web-first implementation uses two app-owned browser windows:

1. An audience-facing presentation window containing only the imported slides.
2. A private presenter window containing the script, cues, timer, and controls.

The audience window is opened or reused from an explicit user action in the private Presenter tab. Its state stays synchronized with the private view while the session is active. If it closes, loses focus, or cannot be opened because of browser popup controls, the private view must surface the state clearly and offer recovery without losing the presentation session.

The product cannot guarantee that every operating system or meeting platform will hide a private window from screen capture. Therefore:

- the documented workflow must be selected-window sharing;
- the preflight must identify the shareable window clearly;
- window titles should distinguish presentation from private presenter view;
- the user should be able to practice the sharing workflow;
- the app should warn when the wrong window is selected where detection is possible; and
- any future "hide from capture" feature must be described as best-effort.

Privacy requirements:

- do not expose scripts or cues in the audience window;
- provide clear deletion controls for imported files and generated content;
- explain whether files are processed locally or sent to an AI service;
- avoid sending microphone data unless the user explicitly enables speech analysis;
- provide failure messaging that does not expose private content in shared surfaces; and
- make export and local caching behavior understandable.

The deployed application must also isolate each user's database records and storage objects, disclose the AI processing and any project-level data-sharing settings, and support account/data deletion. Section 25 defines account security, storage, quota enforcement, and deployment requirements. Private presenter support must remain inaccessible to the audience even when projects are stored in the cloud.

## 14. Product surfaces

### 14.0 Public landing page and authentication

Unauthenticated visitors should see a concise landing page explaining the product and showing **Log in** and **Sign up**. Signup and login use the configured OAuth provider. Successful authentication opens the user's private workspace. Existing users can log in when signup capacity is full; new visitors see an honest capacity message and an optional access-request path. Include privacy and terms links, clear OAuth error/retry states, and responsive, accessible controls. Account settings expose profile, sign out, remaining allowance/reset time, export, and deletion.

### 14.1 Home / workspace

The home screen should be a functional, calm workspace with the familiar density and clear hierarchy of a ChatGPT-style application shell, without copying ChatGPT branding or turning the product into a chat interface. It must not contain advertising, upgrade messaging, exaggerated product claims, fake activity, or promotional sample content presented as user data.

The desktop layout has a persistent left sidebar and a focused main workspace.

#### Presentation sidebar

The left sidebar contains:

- a prominent **Add presentation** action;
- the user's presentations, ordered by recent activity and searchable when the list is long;
- each presentation's title, small import/script status, and active-state highlight;
- a three-dot action menu on each presentation; and
- settings and account actions at the bottom, separated from project work.

The three-dot menu is the compact place to manage a presentation: rename it, open its overview, edit its setup brief, duplicate it, replace its imported deck, export, or delete it. These actions edit the PresentationPrompter project and its setup; they do not imply full PowerPoint slide editing.

#### Add-presentation flow

Selecting **Add presentation** keeps the sidebar visible and opens a centered, single-purpose creation flow in the main pane. The default order is:

1. **Upload slides.** Drop or choose PDF, PPTX, or ordered images; show validation, import status, slide thumbnails, and unsupported-feature warnings. Check the account's slide, file, storage, and generation limits on the server.
2. **Generate automatically.** Infer the title and brief, apply saved preferences or sensible defaults, reserve quota, and produce the complete draft. Show a calm generation state with cancellation and recovery where needed. Optional settings remain available without requiring completion.
3. **Review the ready script.** Open the teleprompter script editor when validation completes. The user can edit, change optional setup, or request regeneration explicitly.

The flow must preserve progress when the user switches presentations or reloads. Account access, a valid supported import, and necessary privacy consent are the only default-path prerequisites; no required narrative questionnaire or manual prompt is added.

#### Existing-presentation workspace

Selecting an existing presentation opens a single overview workspace before Presenter mode. The header shows the presentation title, saved state, a compact project actions menu, and a primary **Start presentation** button. The main area shows the deck, the current script, and the live delivery preview together:

- a slide rail for choosing and reviewing slide context;
- a large current-slide preview;
- a readable current script and cue summary with timing status; and
- a Presenter preview that shows how the selected script block will look while delivering.

The overview provides direct entry points to **Edit script**, **Edit setup**, import review, and session review. It should make the current deck, script, timing, cues, and delivery preview understandable at a glance without forcing the user into Presenter mode. **Start presentation** opens the private Presenter tab and then guides the user to open the audience presentation window.

On narrow screens, the same information becomes ordered sections or tabs; the sidebar collapses into a presentation switcher, but **Add presentation**, project actions, and **Start presentation** remain directly reachable.

### 14.2 Import review

The import review should show what the system understood and let the user correct slide order, add missing context, and address unsupported elements. It is optional for a valid import; a file error, exceeded limit, or material rendering problem can require correction before automatic generation.

### 14.3 Teleprompter script editor

The dedicated teleprompter script editor should use a two-pane or responsive layout:

- slide preview and slide navigation on the left;
- editable spoken script, teleprompter markers, cues, timing, and targeted AI actions on the right.

It should also offer a direct Presenter-mode preview for the selected script block. AI actions should be contextual to the selected slide or text rather than hidden in a generic chat panel.

### 14.4 Presenter mode

There is one Presenter mode for both practice and live use. It emphasizes timing, readability, and repeatability; the user can reveal more coaching detail while practicing and keep only the current or next cue visible while live.

### 14.5 Post-session review

After any Presenter-mode session, show a concise review:

- total duration;
- time by slide;
- slides that exceeded their target;
- skipped or repeated slides;
- cues that were hidden or ignored; and
- recommended edits.

## 15. MVP definition

The MVP should validate the core loop rather than attempt to become a presentation editor or a complete speaking coach.

### MVP must have

- web-first browser experience with a private Presenter tab and a synchronized audience presentation window opened from an explicit user action;
- a public landing page with OAuth login/signup and authenticated private workspaces;
- user accounts, account admission limits, secure sessions, and server-side authorization;
- persistent database records and private bucket storage with per-user access policies;
- configurable, atomic generation/token/slide/file/storage limits and an owner-operated AI kill switch;
- PDF import;
- image import;
- basic PPTX or PowerPoint import if it can be rendered reliably;
- static slide rendering with no animation support;
- slide order and import validation;
- automatic first-draft generation after a valid import, with optional setup and editable defaults for duration, Q&A time, speaking rate, word budget, script depth, and cue density;
- script generation grounded in slide content;
- a central script generation and editing surface;
- a dedicated teleprompter script editor with slide-by-slide editing, reading markers, timing, fallback versions, and Presenter-mode preview;
- regenerate, shorten, expand, and change-tone actions;
- AI-inferred deck context plus an optional user-stated presentation goal in setup;
- a synchronized presenter mode;
- manual next, previous, jump, and reset controls;
- smooth manual and automatic teleprompter scrolling;
- automatic next-slide behavior when the current script completes, with a user setting to disable it;
- current-slide and next-slide context;
- timer and progress display;
- at least a small set of delivery cues;
- cloud project persistence with local recovery caching and migration of existing local projects;
- script export or copy; and
- clear selected-window sharing guidance.

### MVP should have if feasible

- multimodal analysis for slide images;
- visual references in cues;
- recovery prompt for losing place;
- short fallback script per slide;
- presenter-session timing per slide;
- import confidence and unsupported-content warnings; and
- reduced-motion and large-text presentation settings.

### Defer until after validation

- full PowerPoint, Keynote, or Google Slides editing;
- preserving animations and transitions;
- live AI rewriting while the presenter is speaking;
- automatic gesture recognition;
- AI avatars or synthetic voices;
- audience sentiment detection;
- direct Zoom, Teams, or Meet integrations;
- guaranteed invisible overlays across every operating system;
- cloud collaboration and multi-user editing;
- public templates marketplace;
- social sharing and presentation rankings; and
- complex enterprise administration.

## 16. Suggested technical architecture

The current application is a web-based interface with server-backed AI generation and local persistence. The deployed product must add managed authentication, persistent user-owned database records, private object storage, and durable server-owned AI jobs. Local persistence becomes a recovery/offline cache rather than the sole source of truth. The product direction should preserve the ability to evolve toward a desktop shell because multiple windows, global shortcuts, local file access, and presentation sharing are central to the experience.

The selected pilot architecture is **Vercel** for the Next.js app (landing page, workspace, and API routes) plus **Firebase** for authentication (Firebase Authentication), the application database (Cloud Firestore), and private file storage (Cloud Storage for Firebase). Durable AI jobs run on Vercel. The stack is decided but not yet provisioned. Section 25 defines the controls and launch gates. Cloud collaboration and simultaneous multi-user editing remain separate future features.

### Client responsibilities

- import selection and drag-and-drop;
- presentation and slide navigation;
- teleprompter script editor state, editing, and preview;
- presenter state and controls;
- teleprompter scrolling;
- cue visibility and personalization;
- local draft recovery caching and authenticated cloud autosave;
- presenter-session timer and event recording; and
- presentation-window and private-window coordination.

### Server responsibilities

- file ingestion and validation;
- extraction of slide text and images;
- OCR fallback;
- visual analysis;
- script generation;
- targeted rewrite actions;
- structured output validation;
- simple generation-state and error reporting without exposing partial output;
- OAuth sessions, account provisioning, ownership checks, and account deletion;
- authoritative file/slide/storage validation and private object access;
- atomic account/quota reservations, AI usage reconciliation, and abuse controls; and
- persistent project/version storage, job execution, retries, and synchronization across the user's devices.

### Canonical data model

The canonical project model should separate source content from generated content:

~~~text
Project
  id
  owner user ID
  title
  source file metadata
  created and updated timestamps
  presentation brief
  user preferences
  Slides[]
    id
    source position
    rendered image or source reference
    extracted text
    visual analysis
    import warnings
    ScriptVersions[]
      spoken blocks
      cues
      transitions
      short version
      timing estimate
      generation metadata
    presenter-session records
~~~

The presenter state should be separate from saved script content so a temporary live position does not accidentally overwrite the project. The deployed model also needs user profiles, account-slot reservations, storage-object metadata, generation jobs, per-request usage records, daily quota reservations, and administrator-controlled limit configuration. All project-related records must have enforceable ownership relationships. In Firestore, project data lives under `users/{uid}/...` and Security Rules allow access only when the signed-in user's ID matches `{uid}` (section 25.4).

### AI pipeline

1. Validate the file and normalize it into slide records.
2. Extract text, images, and available metadata.
3. Run OCR only where needed.
4. Analyze visual structure and important regions.
5. Build a concise presentation outline.
6. Generate a structured script and cue set.
7. Validate slide-to-script grounding and timing.
8. Flag unsupported claims or uncertain visual interpretations.
9. Persist the result as an editable version.

Generation may process a deck incrementally internally for reliability and cost control, but the user should see the completed, validated draft rather than partial slide output. The interface should remain calm and avoid surfacing technical generation stages.

## 17. AI quality and safety rules

The AI should optimize for spoken delivery:

- shorter sentences;
- natural contractions;
- explicit but concise transitions;
- language that can be glanced at;
- terminology appropriate for the audience;
- no unnecessary claims beyond the source material; and
- an adjustable balance between exact script and flexible notes.

The AI must:

- ground factual statements in the imported deck or user-provided brief;
- mark unsupported claims for review;
- preserve required facts and technical terms;
- identify when a slide is too ambiguous to interpret confidently;
- avoid inventing numbers, sources, or customer stories;
- avoid giving medical or psychological advice under the guise of presentation coaching; and
- let the user see and edit the output before presenting.

The AI should not:

- force an extroverted or overly enthusiastic voice;
- generate a cue for every sentence;
- recommend distracting or theatrical gestures by default;
- rewrite user edits without warning;
- present uncertain image analysis as fact; or
- make the presenter dependent on a constantly changing live model.

## 18. Success metrics

The most important early question is whether presenters feel more prepared while still sounding like themselves.

### Activation

- percentage of users who import a presentation;
- time from first import to first usable script;
- percentage of users who start Presenter mode; and
- percentage of users who complete a first presentation session.

### Script usefulness

- percentage of generated text retained by users;
- edit distance between generated and final script;
- number of targeted rewrite actions per slide;
- number of unsupported-claim warnings accepted or corrected; and
- user rating of naturalness and accuracy.

### Delivery usefulness

- presenter-session duration compared with target duration;
- slides that consistently run long;
- frequency of manual recovery actions;
- percentage of sessions where presenter and audience windows remain synchronized;
- successful next-slide progression; and
- user-reported confidence before and after a presenter session.

### Privacy and reliability

- rate of wrong-window sharing incidents in testing;
- import failure rate by file type;
- percentage of sessions that can be reopened without data loss;
- AI generation failure rate;
- presenter window recovery after focus loss; and
- user understanding of the selected-window sharing instruction.

Qualitative feedback matters as much as usage numbers. Listen for whether users say:

- "I could finally focus on the audience."
- "The cues helped me explain the slide instead of reading it."
- "I still sounded like myself."
- "I knew what to do when I lost my place."

## 19. Risks and mitigations

### Wrong-window sharing

**Risk:** The presenter shares the private script window or entire desktop.
**Mitigation:** Separate windows, explicit titles, preflight checklist, selected-window documentation, and a practice-sharing flow.

### AI hallucination

**Risk:** The generated script invents facts or overstates what a slide shows.
**Mitigation:** Source-grounded generation, structured validation, traceability, unsupported-claim warnings, and user approval.

### Over-scripted delivery

**Risk:** The presenter sounds like they are reading or becomes dependent on the prompt.
**Mitigation:** Concise default script, adjustable script depth, cue density controls, fallback notes, and Presenter-mode controls that gradually reduce detail.

### Visual misinterpretation

**Risk:** A chart, diagram, or image is interpreted incorrectly.
**Mitigation:** Combine extracted text with visual analysis, show confidence, cite visual regions, allow manual context, and never hide uncertainty.

### Unwanted automatic slide advancement

**Risk:** The teleprompter advances before the presenter is ready.
**Mitigation:** Explicit setting, transition guard, manual override, pause precedence, visible countdown or transition state, and easy previous-slide recovery.

### Import quality and unsupported features

**Risk:** Animations or complex PowerPoint content changes the meaning of the deck.
**Mitigation:** Static rendering scope, clear warnings, import preview, PDF recommendation for complex decks, and a replacement or correction flow.

### Latency and cost

**Risk:** Large decks take too long to analyze or cost too much to process.
**Mitigation:** Internal incremental processing, caching, per-slide regeneration, compact visual summaries, a calm generation state, and clear retry behavior.

### Anxiety-inducing product design

**Risk:** Metrics, alerts, or overly prescriptive coaching increase the user's stress.
**Mitigation:** Calm defaults, low-stimulation UI, optional coaching, no social ranking, and user-controlled cue density.

## 20. Implementation milestones

### Milestone 0: interaction and privacy spike

- confirm required operating systems and display configurations;
- test presentation and private windows;
- test keyboard and remote-clicker navigation;
- test window sharing behavior in common meeting platforms;
- build a thin synchronized prototype with hard-coded slides and script data.

**Success criterion:** A user can share only the presentation window while reading a private script and advancing both views together.

### Milestone 1: project model and import

- add project/session creation;
- implement PDF and image import;
- add basic PPTX rendering if reliable;
- store slide images, extracted text, and order;
- show import review and warnings;
- reopen the same project without data loss.

**Success criterion:** A user can import, close, reopen, and see the same presentation content and slide order.

### Milestone 2: teleprompter script editor

- add automatic generation after valid import with optional session setup;
- add editable defaults for duration, speaking rate, and cue density;
- calculate and display raw and usable word budgets;
- resolve the AI brief from defaults, inferred context, and optional user input;
- infer deck context and allow the user to supply a presentation goal;
- generate structured scripts;
- add teleprompter-specific editing and Presenter-mode preview;
- add targeted rewrite actions;
- add timing estimates, word-count validation, and short versions;
- persist versions and user edits.

**Success criterion:** A user can produce and edit a complete, slide-aware script without leaving the application.

### Milestone 3: teleprompter and Presenter mode

- implement synchronized presenter state;
- add smooth manual and automatic scrolling;
- add next-slide behavior at script completion;
- add manual override and recovery;
- add current and next-slide context;
- add timer, progress, and slide-level presenter-session timing;
- add large-text, focus-line, and cue-density controls.

**Success criterion:** A user can practice or present a complete deck in Presenter mode, recover from losing their place, and keep the presenter state synchronized.

### Milestone 4: multimodal coaching

- add image and layout analysis;
- add visual references to cues;
- add chart, diagram, and screenshot guidance;
- add confidence and review flags;
- add user controls for accepting and hiding cues;
- evaluate cue usefulness with real presenters.

**Success criterion:** Visual cues help users explain what the audience is seeing and are more useful than generic speaking advice.

### Milestone 5: reliability and launch readiness

- add the public landing page and OAuth login/signup;
- provision user accounts, private database/storage access, and cloud project persistence;
- move AI orchestration into durable server jobs with usage accounting;
- enforce configurable signup, generation, token, slide, file, and storage limits;
- validate the complimentary-token offer and complete the security, privacy, and budget acceptance checks in section 25;
- test common meeting platforms and display arrangements;
- handle lost focus, closed windows, slow imports, and AI failures;
- add deletion and export behavior;
- improve onboarding and sharing preflight;
- measure import-to-Presenter-mode completion;
- run user testing with introverted and low-stimulation presenters.

**Success criterion:** A first-time user can complete import, script review, and a private Presenter-mode workflow without live assistance.

## 21. Validation plan

Test the smallest valuable loop with up to ten pilot accounts. Additional presenters can participate in staged cohorts only when account slots and budgets are available or the owner changes the pilot limits:

1. Sign up or log in and import an existing presentation.
2. Confirm that the script generates automatically without required setup.
3. Review the extracted slides and completed draft.
4. Edit one or two slides.
5. Practice or present with the synchronized teleprompter in Presenter mode.
6. Trigger a recovery flow intentionally.
7. Present for 5 to 10 minutes using separate windows.
8. Review timing and coaching cues.

Ask:

- Did the user feel more prepared?
- Did the generated language sound like them?
- Did the teleprompter reduce or increase cognitive load?
- Did automatic slide progression feel helpful or risky?
- Were visual cues specific to the slide?
- Did the user understand what the audience could see?
- Was the amount of guidance appropriate?
- Would the user use the product for a real presentation?

The core validation metric is not script length or model sophistication. It is whether the product helps someone present with less mental overhead and more control while preserving their natural communication style.

## 22. Recommended positioning

The product should be positioned narrowly at first:

> A private, slide-aware presentation companion for people who want to present clearly without memorizing every word.

Alternative short descriptions:

- A teleprompter that understands your slides.
- Private speaker notes, visual cues, and presenter support for real presentations.
- Bring your deck. Get a script that helps you sound like yourself.

Avoid positioning that implies:

- the app will make someone charismatic;
- the AI can replace presentation practice;
- the app guarantees a hidden overlay in every meeting tool;
- the presenter should follow every cue exactly; or
- the product is only for people who are anxious or deficient.

## 23. Product decisions to make next

The following decisions affect implementation scope and should be made before the next major build phase. The first-release platform is decided: it is a browser app with synchronized private Presenter and audience windows; a desktop shell can be considered later.

- Which platforms must be supported first: Windows, macOS, or both?
- Is PDF enough for the first pilot, or is basic PPTX mandatory?
- Which presentation window rendering approach is reliable enough for live use?
- What is the minimum acceptable synchronization behavior when a window loses focus?
- The deployment stack is decided: Vercel for the app, and Firebase Authentication, Cloud Firestore, and Cloud Storage for accounts and data (section 25). Google is the first sign-in provider.
- Measure full-generation runtime to decide whether generation fits one 300-second Vercel Function or needs Vercel Workflows (section 25.7).
- Confirm the pilot qualifies as personal, non-commercial use under Vercel Hobby; commercial use requires Vercel Pro.
- Confirm final account, generation, token, slide, file, and storage limits after pipeline measurements.
- Verify the owner's complimentary-token eligibility, reset policy, model coverage, and data-sharing settings before launch.
- Confirm the data retention period. The data region is `us-east1` for Firestore and Cloud Storage. Backup and restore are out of pilot scope.
- Validate that the selected `gpt-5.4-mini` model and file-processing path meet script quality and privacy expectations.
- The default output is a full script with concise fallback notes; confirm whether saved user preferences should change that default.
- How much automatic slide progression should be enabled by default?
- Is microphone-based pace analysis part of the first release or a later experiment?
- Which presenter segment should be the first validation cohort?
- What exact privacy promise can be tested for each supported meeting platform?

## 24. North-star definition

PresentationPrompter is successful when a user can bring a presentation they already made, understand what to say and where to direct attention, use one private Presenter mode for practice or live delivery, and present to an audience while keeping the support private.

The product should leave the presenter feeling:

- prepared rather than over-rehearsed;
- supported rather than monitored;
- clear rather than overloaded;
- calm rather than rushed; and
- more like themselves, not like a generated presenter.

## 25. Full-stack deployment, accounts, and resource limits

### 25.1 Scope and selected services

Authentication, account storage, cloud project persistence, and enforceable usage controls are required for the deployed pilot. The owner selected the following stack on **2026-09-27**:

| Component | Selected service | Responsibility |
| --- | --- | --- |
| Web application and API | Vercel (Hobby plan), Next.js built natively | Public landing page, private workspace, server sessions, authenticated APIs, upload admission, and AI gateway |
| Authentication | Firebase Authentication upgraded to Identity Platform, Google sign-in first | Managed identity, ID tokens, and the `beforeUserCreated` admission function. Microsoft can be added if the pilot needs it. |
| Application database | Cloud Firestore (Standard edition, `us-east1`) | User profiles, owned projects/slides/scripts, preferences, job state, account slots, quota configuration, and usage ledger |
| File storage | Cloud Storage for Firebase (default bucket, `us-east1`) | Source decks, rendered slide images, thumbnails, and exports, protected by Storage Security Rules |
| Admission function | Cloud Functions for Firebase (2nd gen) | The `beforeUserCreated` blocking function that enforces the account cap |
| Background execution | Vercel Functions; Vercel Workflows if a generation cannot finish in one function run | Durable AI jobs, checkpoints, bounded retries, and failure alerts |
| AI | OpenAI Responses API, `gpt-5.4-mini` | Slide analysis and script generation through the server only |
| Configuration as code | Firebase CLI project files (`firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `functions/`) | Reviewed, versioned rules, indexes, and functions for development, staging, and production projects |

Vercel runs Next.js natively, so the app builds with `next build` and no longer needs the `vinext` Cloudflare adapter or Wrangler. Move the security headers from `worker/index.ts` into `next.config.ts`. Firestore is the canonical store for project data; do not maintain a parallel canonical database. IndexedDB remains a per-user local cache only (section 25.4).

**Two access paths.** The browser uses the Firebase web SDK to read and edit the signed-in user's own projects and to upload files, with Security Rules as the authorization boundary. The Vercel server uses the Firebase Admin SDK for anything the user must not control: AI jobs, quota and token reservations, account slots, limit configuration, and deletion. The Admin SDK bypasses Security Rules, so every server path does its own ownership check.

**Connecting Vercel to Google Cloud.** Use a **dedicated service-account key** stored as a Vercel sensitive environment variable. Grant it only the Firestore, Storage, and Firebase Authentication admin roles the server needs, and rotate it on a schedule and after any suspected exposure. Keyless Vercel OIDC federation is not used: the Firebase Admin SDK's Firestore and Storage clients accept only a service-account credential or application default credentials, and throw for any other credential type. Vercel exposes its OIDC token only per request (`x-vercel-oidc-token` header), so file-based application default credentials cannot use it cleanly. [Admin SDK Firestore credentials](https://github.com/firebase/firebase-admin-node/blob/master/src/firestore/firestore-internal.ts), [Admin SDK Storage credentials](https://github.com/firebase/firebase-admin-node/blob/master/src/storage/storage.ts), [Vercel OIDC reference](https://vercel.com/docs/oidc/reference)

**Region.** Put Firestore and the Storage bucket in `us-east1`. Storage's no-cost allowance applies only in `us-central1`, `us-east1`, and `us-west1`, and `us-east1` is closest to Vercel's default `iad1` function region. A Firestore location cannot be changed after creation. [Storage no-cost regions](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)

**Local development.** Use the Firebase Emulator Suite (Auth, Firestore, Storage, Functions) for development, rules tests, and Playwright end-to-end tests, alongside the existing `AI_PROVIDER=demo` mode.

### 25.2 Account admission and lifecycle

- Make signup available from the landing page, subject to a configurable maximum number of provisioned pilot accounts. Start with **ten accounts total**, including any owner/admin account that uses AI; roles do not create unbudgeted AI exemptions.
- For the pilot, use owner-issued invitations or an approved-identity allowlist to allocate the available slots. Public visitors may request access without being provisioned automatically.
- Enforce admission at the authentication provider's account-creation boundary as well as the application API. A **`beforeUserCreated` blocking function** runs before Firebase creates a user, including a user's first Google sign-in, and can reject signup by throwing an error. Blocking functions require upgrading the project to Firebase Authentication with Identity Platform (free at pilot scale) and must respond within 7 seconds. A hidden signup button alone cannot enforce the cap. Enable only the Google provider so there is no other way to create an account. [Blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions)
- Reserve available slots atomically, including pending signups. The blocking function claims a slot in a Firestore transaction on the account-slot document, so simultaneous requests for the final slot admit only one new account. Use bounded, recoverable reservations and reconciliation for abandoned/failed OAuth callbacks; release a provisioned slot only after account removal is confirmed. Existing users must remain able to log in when capacity is full.
- Key ownership and quotas to the immutable Firebase user ID (`uid`). Linking an additional OAuth identity must not create another allowance. Keep Firebase's default one-account-per-email setting, so a second provider with the same email links to the existing user instead of creating a new one. Account deletion/recreation must not bypass invitation controls or reset the shared daily budget.
- Persist profile, preferences, role, account state, and consent version. Provide sign out, account/data export, and account deletion; suspended/deleted accounts cannot start jobs or retrieve private objects.

### 25.3 Authentication and security requirements

- Use the managed provider's authorization-code flow with PKCE and the appropriate state/nonce protections. Configure exact production callback/redirect allowlists and minimal identity scopes. Do not request access to the user's Drive or other provider content merely to log in. [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- Firebase Authentication allows sign-in only from listed authorized domains. List the production domain and one fixed staging domain. Vercel preview deployments get random URLs, so login is unavailable on previews unless a preview is served from the staging domain.
- **Session model.** The browser keeps its Firebase Authentication session through the web SDK, because Security Rules can only authorize direct Firestore and Storage access from a signed-in SDK. These tokens are readable by page JavaScript; this replaces the earlier preference for HttpOnly-only sessions. Mitigate XSS with a strict Content Security Policy, no third-party scripts on authenticated pages, and short-lived ID tokens (Firebase refreshes them hourly). Server API routes accept the ID token in an `Authorization` header rather than a cookie, which avoids CSRF on those routes. Validate the integration on the deployed Vercel runtime.
- Verify identity on the server with the Admin SDK's `verifyIdToken` and revocation checking, which covers signature, issuer, audience (project ID), and expiration. Never trust a user ID or role sent in the request body. Check current account/session state for generation, deletion, and administrator operations so suspension/revocation takes effect.
- Authorize every project, slide, script, job/status, export, and storage operation against its owner. Firestore and Storage Security Rules allow a user to reach only paths under their own `uid`. Rules deny all client writes to server-owned data: jobs, usage ledger, quota and token reservations, account slots, roles, and limit configuration. Server routes using the Admin SDK bypass Rules, so they take the user ID only from the verified token and check ownership explicitly. Test Rules with the emulator's rules-unit-testing library, and test direct SDK and API access with another user's IDs.
- Keep the OpenAI key and any Google Cloud credentials in Vercel sensitive environment variables (section 25.1). Admin credentials never reach the browser. The server identity can read every user's data, so privileged code paths need explicit ownership checks and narrowly scoped operations. Enable Firebase App Check for Firestore, Storage, and Auth to reject requests that do not come from the real app.
- Use HTTPS, suitable security headers/CSP, restricted CORS, safe redirect validation, and request-size limits. Authenticated responses and download URLs must not leak through shared caches. Do not use Storage public download-token URLs; fetch files through the authenticated SDK so Rules apply to every read.
- Rate-limit signup/login, uploads, and AI actions using shared server-side state (Firestore counter documents with expiry) and account/IP signals; apply Vercel firewall rules where appropriate. A per-process in-memory counter is insufficient across Vercel Function instances.
- Restrict administrator controls through server-managed roles, require administrator MFA, and audit admission changes, limit changes, suspensions, and deletion. Logs must omit deck/script content, credentials, session tokens, and signed URLs.
- Treat imported slide text as untrusted input. It must not alter system instructions, invoke unauthorized tools, or expose another user's data through AI requests.

### 25.4 Persistent data and private buckets

- Store user-owned project content, script versions, preferences, and presenter-session records in Firestore under `users/{uid}/...`. Store server-owned data (jobs, usage ledger, quota and token reservations, account slots, roles, limit configuration) in separate collections that clients can read only where needed and never write. Use Firestore transactions for every limit check and reservation. Keep each document under Firestore's 1 MiB limit: store scripts per slide and keep binaries in Storage. [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- Stay within Firestore's free daily allowance (50,000 reads, 20,000 writes, 20,000 deletes; 1 GiB stored). Debounce autosave and write only changed slides; measure daily usage during the pilot.
- Store binary originals and derived images in the default Cloud Storage bucket under `users/{uid}/projects/{projectId}/...`. Firestore metadata records owner ID, project ID, size, type, checksum, and lifecycle state for each object.
- The browser uploads directly with the Firebase Storage SDK. Storage Security Rules check the owner path, `request.resource.size` against the upload limit, and `request.resource.contentType`. Rules cannot total a user's storage, so the server first writes an upload reservation after checking the storage allowance, and the rule requires it with `firestore.exists()`. Files never pass through Vercel, whose functions accept at most 4.5 MB per request. [Storage rule conditions](https://firebase.google.com/docs/storage/security/rules-conditions), [Vercel request limits](https://vercel.com/docs/functions/limitations)
- Downloads go through the authenticated Storage SDK so Rules check ownership on every read. Object-name obscurity is not authorization. The audience view must receive only the slide assets and minimal playback state it needs; no script, cue, or full project payload.
- Enforce file type, bytes, slide count, and storage allowance on the server. Inspect content rather than trusting filename/MIME headers or client-reported slide counts. Bound decompressed PPTX size, parser work, image dimensions, and conversion time; reject unsupported/encrypted/malformed content clearly. Validate/quarantine uploads before AI processing or publication to playback surfaces.
- Storage accounting includes originals, images, thumbnails, exports, and retained versions. Reserve bytes before accepting an upload, reconcile actual sizes, and clean up abandoned uploads. Replacements and duplicated projects must obey the same rules.
- Autosave user edits with version/revision checks so another tab or a completed generation cannot overwrite newer work silently. Confirm cloud saves before reporting that data is safely persisted.
- Offer explicit migration of existing IndexedDB projects into the signed-in account, with deduplication and quota checks. Namespace local caches by user and prevent the next signed-in user from seeing the previous user's cached projects.
- Define retention and deletion completion before launch; the data region is `us-east1`. Cancel outstanding jobs when deleting data, and remove dependent documents, subcollections, and Storage objects. Deleting a Firestore document does not delete its subcollections, so deletion must remove them explicitly.
- **Backup and restore are out of pilot scope.** Do not enable Firestore point-in-time recovery, scheduled backups, or bucket object versioning. Deletion is therefore final, and data lost to operator error or a service failure cannot be recovered. State both plainly in the privacy policy and terms. User-initiated export (section 25.2) is the only copy a user can keep.

### 25.5 Proposed pilot limits

All values below are **provisional defaults**, not measured capacity or final owner-selected limits. Store them in administrator-controlled server configuration; the client displays the policy but cannot enforce or change it authoritatively.

| Resource | Proposed initial limit | Enforcement |
| --- | --- | --- |
| Provisioned accounts | 10 total | Atomic account-slot reservation and provider signup gate |
| Full script generations | Up to 5 per user per UTC day, subject to shared app capacity | Count the automatic first draft and every explicit full regeneration |
| Slides | 20 per presentation | Validate trusted normalized slide count before any AI work |
| Source upload | 20 MB total per import | Includes the combined size of an ordered image group |
| Saved presentations | 5 per user | Creation/duplication admission; storage allowance also applies |
| Stored objects | 100 MB per user | Originals plus all derivatives; ten users reserve up to 1 GB |
| Tokens per full-generation job | 80,000 | Entire pipeline, including analysis, writing, reasoning, repair, and retries |
| Daily tokens per user | 400,000 | Shared by full generations and all other AI actions; a ceiling, not a guarantee |
| Daily operational tokens for the app | 2,000,000 | Shared first-come by all users and checked before any per-user allowance is used. Includes every real AI call, including owner/admin/test traffic in the same project |
| Concurrent generation jobs | 1 per user, 2 globally | Firestore transactional admission, with separate bounded per-job request concurrency |

Targeted rewrites, audience questions, support generation, and automatic analysis must use the same token ledger. They cannot become unmetered routes around the five-generation limit. Rewrites consume the daily token allowance, so five complete generations are an upper bound rather than a promise of five generations plus unlimited edits. Non-AI editing, reopening, export, and presenting remain usable after AI allowance is exhausted.

Ten accounts with five generations each can request more than the app-wide daily budget allows (section 25.6). The owner accepted this oversubscription: per-user limits are ceilings, and the shared daily cap is enforced first-come. When shared capacity is exhausted, tell the user that the app's daily AI capacity is used up and when it resets. Do not show this as a problem with the user's own allowance.

Show remaining generations and the next reset time in account settings and near relevant AI actions. Explain exceeded slide/file/storage limits before processing. When AI quota is unavailable, preserve the import/draft and offer a clear later retry or manual editing path. Do not silently truncate the deck or launch paid overflow.

### 25.6 Complimentary-token budget calculation

**Planning assumption supplied by the owner:** the OpenAI organization has **2,500,000 eligible complimentary tokens per day** in the model pool that includes `gpt-5.4-mini`. This is an organization-wide shared allowance, not 2.5 million tokens per user and not a guaranteed general free-trial entitlement. Confirm the actual offer, eligible model/snapshot, expiration, reset boundary, sharing requirements, and overflow behavior in the owner's dashboard before launch. Usage by other apps in the same organization reduces available capacity.

~~~text
20% planning headroom = 500,000 tokens/day
Operational budget = 2,500,000 - 500,000 = 2,000,000 tokens/day
Sized capacity = 25 full generations/day
2,000,000 / 25 = 80,000 tokens/full generation
5 x 80,000 = 400,000 tokens/user/day ceiling

10 users x 5 full generations/day = 50 possible requests/day
50 x 80,000 = 4,000,000 tokens (2x the operational budget)
=> the app-wide 2,000,000 cap binds first; about 25 full generations/day are served first-come
~~~

| Actual average tokens across the complete pipeline | Tokens for 25 generations | Fits the proposed 2 million operational budget? |
| --- | --- | --- |
| 40,000 | 1,000,000 | Yes |
| 60,000 | 1,500,000 | Yes |
| 80,000 | 2,000,000 | Yes, at the operational ceiling |
| 100,000 | 2,500,000 | No; consumes all assumed complimentary allowance |
| 120,000 | 3,000,000 | No; exceeds the assumed allowance |

**Conclusion:** the budget supports about 25 full generations a day if every complete generation stays within the proposed 80,000-token ceiling and other traffic fits the same operational budget. With ten accounts that is an average of 2.5 per user per day. Each user may use up to five while shared capacity remains, and nobody is guaranteed five on a busy day. The current pipeline's consumption has not been benchmarked; a 20-slide limit alone cannot guarantee this.

Count input and output tokens across every request, including image input, repeated context, hidden reasoning, repairs, and unsuccessful attempts where usage was consumed. Reasoning tokens are included in output usage: do not add them a second time. Count cached input conservatively for the app quota unless the actual complimentary-offer rules justify a different allowance calculation. Bound generated tokens, including reasoning, with per-request `max_output_tokens`. [OpenAI reasoning and usage documentation](https://developers.openai.com/api/docs/guides/reasoning)

For scale, under the documented `gpt-5.4-mini` image accounting, one 1280 x 720 image uses 40 x 23 = 920 patches, multiplied by 1.2 = approximately 1,104 input tokens. An analysis pass over 20 such slide images alone uses approximately **22,080 image tokens**, before text, instructions, generated output, or repeated passes. Other resolutions can change this estimate. [Image token accounting](https://developers.openai.com/api/docs/guides/images-vision)

Before finalizing limits, measure representative 5-, 10-, and 20-slide decks, including dense text/charts and worst-case repair/retry paths. Record total usage, completion rate, latency, and script quality. Use those measurements to set bounded input/output budgets for each stage. Cache unchanged slide analysis by owner, source revision, model, and prompt version; invalidate it when relevant inputs change. Reassess headroom if organization-wide traffic or offer eligibility changes.

### 25.7 Atomic enforcement and durable generation

1. Authenticate and authorize the requested operation. Validate normalized source limits and estimate a conservative upper bound for input plus permitted output across the job.
2. In one Firestore transaction, reserve the logical generation slot, the app-wide and user token allowances, and the concurrency slot. Use an idempotency key scoped to user, project revision, and action. Enforce `consumed + reserved <= limit`; concurrent requests must not oversubscribe the final slot or tokens.
3. Persist the job in the same transaction, then start it. If the job was saved but never started (for example, the function crashed in between), a recovery pass finds and starts it. The browser must not orchestrate independently billable calls or supply trusted usage figures.
4. Before every model request, reserve a safe input bound plus its maximum output within the job's allocation. If the next step cannot fit, stop before dispatch, preserve work, and return a clear recoverable state. Do not rely on an optimistic average estimate to protect the budget.
5. Persist each attempt's provider request ID, model, stage, input/output usage, reservation, and timestamps. Reconcile returned usage once and release only unused reservation. Failed or canceled work still consumes actual tokens; cancellation must not refund usage already spent. A failure before any provider work may release the logical generation slot.
6. Retry only unfinished steps, using bounded attempts and counted token reservations. A step can run more than once after a crash or retry, so steps must be idempotent through persistent job claims and checkpoints in Firestore. A crash after a provider call can leave usage uncertain: retain the conservative reservation and reconcile it rather than retrying indefinitely or promising exactly-once provider billing.
7. Publish a complete validated draft as a new version without overwriting user edits. Persist job completion/failure so reloads and device changes recover correctly. Jobs that exhaust their retries are marked failed and trigger an owner alert.

**Where jobs run.** A Vercel Function on Hobby runs for at most 300 seconds. Measure full-generation runtime on representative 20-slide decks. If it reliably fits with margin, run each job in one function invocation. Otherwise, run it as Vercel Workflows steps, each well under 300 seconds, which resume after crashes and deployments. Workflow step inputs and outputs are recorded and visible to Vercel team owners, so pass only job and project IDs between steps and read deck and script content from Firestore and Storage. Hobby includes 50,000 workflow events and 1 GB of workflow data per month. [Vercel function limits](https://vercel.com/docs/functions/limitations), [Vercel Workflows](https://vercel.com/docs/workflows)

Use UTC for the initial app daily window and display the reset time in the user's timezone; verify alignment with the actual provider offer. Pending jobs must obtain allowance for calls made after a reset rather than carry unaccounted usage into the next day. Expire abandoned reservations safely and reconcile uncertain usage. This application ledger must track all traffic through the app's AI project; separately monitor organization traffic that the app cannot reserve itself.

Provide an audited owner interface to adjust limits, disable signup, pause AI dispatch, and inspect usage/errors without exposing presentation content unnecessarily. Default paid overflow/model fallback to disabled. Stop new AI work when budget telemetry is unreliable, the offer expires, or sufficient eligible allowance is unavailable.

### 25.8 Hosting cost, privacy, and launch requirements

The hosting target is **$0/month** for up to ten users. These costs are separate from complimentary OpenAI tokens.

| Service | Free allowance (checked 2026-09-27) | Expected pilot use |
| --- | --- | --- |
| Vercel Hobby | 1M function invocations, 1M edge requests, 100 GB data transfer, 4 active-CPU hours, and 360 GB-hours of memory per month; 300-second function limit. Exceeding a limit pauses the feature instead of billing. | Well within limits. Time spent waiting on OpenAI does not count as active CPU, but it does count toward memory time; measure generation duration. |
| Firebase Authentication (with Identity Platform) | 50,000 monthly active users for Google and other social sign-in | 10 |
| Cloud Firestore | 1 GiB stored; 50,000 reads, 20,000 writes, and 20,000 deletes per day | Well under 1 GiB; autosave must be debounced |
| Cloud Storage for Firebase | Google Cloud Storage's Always Free tier, which covers new `*.firebasestorage.app` buckets: 5 GB-months of regional storage, 5,000 Class A operations (uploads/lists), 50,000 Class B operations (downloads), and 100 GB outbound transfer per month, in `us-central1`, `us-east1`, or `us-west1` only | About 1 GB. A 20-slide import writes about 41 objects (original, images, thumbnails), so 10 users × 5 decks is about 2,000 uploads. Each deck open reads 20–40 objects, so 50,000 downloads is roughly 1,000–2,500 opens a month; serve repeat opens from the IndexedDB cache. Overage costs cents. |
| Cloud Functions (admission function) | 2M invocations, 400,000 GB-seconds, and 200,000 CPU-seconds per month | A few invocations. Deploying functions also stores build images in Artifact Registry, which may cost a few cents a month; set a cleanup policy. |

**Firebase billing plan.** Put the Firebase project on the **Blaze** (pay-as-you-go) plan. Cloud Storage requires Blaze: for new default buckets since 2024-10-30, and for keeping access to existing buckets since 2026-02-03. Deploying Cloud Functions also requires Blaze. The no-cost allowances above still apply on Blaze. Google Cloud does not stop at a spending limit, so create a Cloud Billing budget alert at $1 before deploying anything. The owner's monthly Google Cloud credit (from Google AI Pro) can absorb small overages. [Firebase pricing](https://firebase.google.com/pricing)

**Vercel plan.** Hobby is limited to personal, non-commercial use. A free pilot qualifies; charging users or operating commercially requires Vercel Pro ($20 per developer seat per month). Vercel Pro also raises the function limit to 800 seconds. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

Also budget conversion/OCR, monitoring, and a custom domain (optional; about $10–15/year). Keep the $0 target by avoiding paid add-ons: Firestore backups and point-in-time recovery, Firebase App Hosting (Vercel hosts the app), phone/SMS authentication, and Cloud SQL. Lengthy rendering must be split into steps that fit the function limit.

OpenAI API data is not used for model training by default, but project/organization opt-in sharing can change that. Verify whether the owner's complimentary offer requires sharing submitted decks/scripts, and disclose the actual setting before the first upload/automatic generation. Do not make an unconditional no-training promise. If the configured terms do not meet the intended data privacy policy, use an appropriately configured paid project or stop AI processing for that material. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)

Deploy separate development/staging/production secrets and data. Use separate Firebase projects for development/staging and production. Keep Security Rules, indexes, and functions in reviewed, versioned Firebase CLI files, run rules tests in the emulator before every deploy, and version Firestore document-shape changes with the application code. Configure production authorized domains and Google consent branding, and keep Vercel's instant rollback available for app deployments. Alerts should cover token headroom, storage/egress, Google Cloud spend, stuck jobs, unknown usage, rejected signup spikes, and provider failures without logging deck content.

### 25.9 Deployment acceptance criteria

- A new approved user can sign up from the landing page, import a valid deck, and receive a complete saved script without filling a setup form. Reopening the project does not generate again.
- Simultaneous signup attempts cannot create more than ten provisioned pilot accounts. An eleventh account is rejected clearly, including attempts through the Firebase Authentication API directly; existing users can still log in. Signing in with a second provider for the same verified email does not create a second allowance.
- User A cannot read, edit, export, delete, or generate against User B's records, objects, or jobs by changing IDs, calling APIs directly, or using the Firebase SDK directly against another user's paths. Clients cannot write jobs, ledger entries, quota reservations, account slots, roles, or limits. Logout and account switching do not expose another user's local cache.
- A sixth full generation in one UTC day is rejected; duplicated requests consume one logical slot. When the app-wide daily cap is exhausted, a user with personal allowance left is rejected before AI dispatch with the shared-capacity message and reset time. A 21-slide deck, oversized upload (including a direct SDK upload that Storage Rules must reject), exhausted storage allowance, or insufficient token reservation is rejected before AI dispatch.
- Concurrent AI actions cannot exceed user/global reservations. Rewrites and automatic analysis consume the ledger. Retry, cancellation, crashes, unknown usage, and midnight reset scenarios preserve accurate conservative accounting.
- A generation survives page reload, function timeout or crash, and step re-execution, preserves prior drafts and newer edits, and reaches a complete saved draft or a clear recoverable failure.
- Expired eligibility, unreliable usage accounting, and the owner kill switch prevent new AI calls. Existing presentations remain available for editing, export, and playback.
- The pilot measures full-pipeline consumption and quality on representative decks and confirms the proposed 80,000-token ceiling is workable before advertising five daily generations per user. It also measures full-generation runtime against the 300-second function limit.
- Privacy consent reflects actual AI sharing settings. Account/project deletion removes Firestore documents (including subcollections), Storage objects, and the Authentication user according to the published retention policy, and the policy states that the pilot keeps no backups.
- Security Rules tests pass in the emulator for owner access, cross-user denial, server-only collections, and upload size/type limits.
- Google Cloud spend for a full pilot month stays at or near $0, with the $1 budget alert confirmed working.

## 26. Research record

**Research dates:** 2026-09-26 (OpenAI vision, reasoning/usage, and data-control documentation, checked on the official developer site) and 2026-09-27 (hosting, authentication, and storage stack). Sources are linked beside the requirements they support. The 2026-09-27 stack research used official vendor pages:

- Firebase: [pricing](https://firebase.google.com/pricing), [Storage billing and no-cost regions](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Google Cloud Storage Always Free limits](https://docs.cloud.google.com/free/docs/free-cloud-features), [blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions) (Identity Platform required; 7-second limit), [session and ID-token handling](https://firebase.google.com/docs/auth/admin/manage-cookies), and [Storage rule conditions](https://firebase.google.com/docs/storage/security/rules-conditions) (size/type checks; up to two Firestore lookups per rule evaluation).
- Vercel: [Hobby plan](https://vercel.com/docs/plans/hobby) (updated 2026-09-14), [function limits](https://vercel.com/docs/functions/limitations) (updated 2026-08-24), [OIDC reference](https://vercel.com/docs/oidc/reference) (updated 2026-09-17), and [Workflows](https://vercel.com/docs/workflows) (updated 2026-09-04).

The 2026-09-26 Cloudflare Workers/Supabase recommendation was replaced by the owner's 2026-09-27 selection of Vercel with Firebase. An AWS alternative (Cognito, S3, DynamoDB) was also evaluated that day. It was also near $0, but it needs a hand-written ownership layer instead of Security Rules, has no local emulator, and requires the AWS Paid account plan.

**Still to confirm before implementation/launch:** exact pilot limits, account invitation policy, actual OpenAI organization offer and shared traffic, measured token consumption and generation runtime, Vercel Hobby non-commercial eligibility, and data retention. The ten-user, five-generation scenario with a shared app-wide cap is the owner's planning decision; the 20-slide and other resource ceilings are adjustable recommendations. This update specifies requirements and does not provision services or implement authentication, storage, or quota enforcement.
