# PresentationPrompter Product Overview

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
Configure the presentation brief
        ->
Generate a slide-aware script and cues
        ->
Review and edit in the teleprompter script editor
        ->
Practice or present with synchronized slides and teleprompter
        ->
Present with the audience view separated from private support
~~~

Every surface should move the user through this loop. The home screen should be a functional workspace for importing and reopening presentations, not a product landing page.

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

Before generating the script, the user should be able to provide a small amount of context. Defaults should make the first run fast, while optional fields improve quality.

Required or strongly recommended fields:

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

The AI should infer the likely presentation context from the imported slides, extracted text, deck structure, and visual content. It must treat that inference as a helpful starting point, not a preset the user must select. The setup form asks the user to state the presentation goal in their own words, such as "persuade the team to approve this plan" or "help new students understand this method." That stated goal takes precedence over any inferred context.

The user should be able to change the brief and regenerate without losing the prior version.

### 7.3.1 Pre-generation session setup form

Script generation should not begin immediately after import. The user should first pass through a short session setup form that makes the presentation constraints explicit. This is the product's planning step: it tells the system how long the presentation should be, how quickly the user wants to speak, and what kind of support should be generated.

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
- generate a first draft automatically when the form is submitted.

The default first-run profile should be editable and visible before generation. A reasonable starting profile is:

- 8-minute presentation;
- 130 words per minute;
- conversational and measured delivery;
- light cues;
- full script with concise fallback notes; and
- no dedicated Q&A time unless the user adds it.

These are product defaults, not fixed assumptions. The user should be able to change them before every session and save preferred values for future sessions.

#### Word-budget planning

The form should calculate a live estimate rather than treating duration as a decorative field.

~~~text
raw word budget = speaking rate (words per minute) x speaking time (minutes)
usable script budget = raw word budget - pause and visual explanation buffer
slide budget = usable script budget allocated across included slides
~~~

For example, an 8-minute session at 130 words per minute produces a raw budget of about 1,040 words. The product should reserve some of that time for pauses, slide transitions, chart explanation, audience reaction, and natural breathing. It should show the user an estimated usable range rather than pretending that every second should be filled with words.

The setup form should show:

- total target time;
- estimated speaking time after any Q&A reservation;
- selected speaking rate;
- estimated total words;
- approximate words per slide or section;
- slides likely to need more explanation; and
- a warning if the chosen settings are inconsistent, such as a very short duration with a full script for a large deck.

The system should allocate words intelligently. A title slide, chart, diagram, and dense content slide should not receive the same word count by default. The allocation can use slide complexity, user-marked importance, and section targets, but the user must be able to override it.

#### Setup review before generation

Before the final generate action, show a compact review summary such as:

> 8 minutes | 130 WPM | approximately 900-1,000 spoken words | 12 slides | light visual cues | 2 minutes reserved for questions

The user should be able to edit any value from this summary without losing their imported deck. The **Generate script** action should make clear that these settings will shape the output.

#### Changing constraints after generation

If the user changes the duration or speaking rate after a script already exists, the product should not silently rewrite it. Offer explicit actions:

- **Rebalance script:** shorten or expand each slide to fit the new plan;
- **Update timing only:** recalculate estimates without changing wording;
- **Change presenter pace:** keep the wording and update teleprompter speed; or
- **Keep current draft:** save the new settings for the next generation.

The user should be able to compare the prior and proposed word counts before applying a rebalance.

### 7.4 Generate and review

The default generation action should produce a complete first draft for the entire deck. The user should not need to understand prompting or AI terminology.

Generation must use the setup form as an explicit constraint, not as background metadata. The generation request should include the target speaking time, Q&A reservation, speaking rate, usable word budget, slide or section allocations, script depth, cue density, delivery style, and user-provided narrative context. The output should be checked against those constraints before it is shown as ready.

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

The teleprompter script editor is a separate interface entered after generation. It is the place where the user turns a complete AI draft into a script they can comfortably deliver. Generation setup belongs before this interface; the editor does not need to expose the generation process.

### 10.1 Default generation

The first action should be simple: the user reviews the AI's inferred deck context, states the presentation goal, accepts or adjusts the setup brief, and selects **Generate script**. The default should create a complete slide-by-slide draft without requiring the user to classify the presentation or write a prompt.

The generation request should use:

- imported slide text;
- slide images or visual descriptions;
- deck outline;
- inferred presentation context and the user's stated presentation goal;
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

The editor should provide focused text-selection actions without becoming a chat interface. Edits should be saved locally or to the user's project store as they work. Saving status should be visible but quiet.

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
- make export and local backup behavior understandable.

## 14. Product surfaces

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

Selecting **Add presentation** keeps the sidebar visible and opens a centered, single-purpose creation flow in the main pane. It must make the next action obvious and follow this fixed order:

1. **Upload slides.** Drop or choose PDF, PPTX/PPT, or ordered images; show local validation, import status, slide thumbnails, and unsupported-feature warnings.
2. **Edit the required details.** Collect the presentation title, user-stated goal, audience, target duration, speaking rate, script depth, and any required facts or constraints. Show the AI-inferred deck context as editable supporting context, never as a preset the user must select.
3. **Generate teleprompter script.** Place the primary action at the bottom of the flow. It remains disabled until required upload and setup values are valid, summarizes the timing/word-budget choices immediately above it, and begins the intentionally non-observable full-draft generation process.

The flow may preserve the user's progress when they switch presentations, but it must not hide required fields behind a chat prompt, a wizard modal, or a separate marketing page.

#### Existing-presentation workspace

Selecting an existing presentation opens a single overview workspace before Presenter mode. The header shows the presentation title, saved state, a compact project actions menu, and a primary **Start presentation** button. The main area shows the deck, the current script, and the live delivery preview together:

- a slide rail for choosing and reviewing slide context;
- a large current-slide preview;
- a readable current script and cue summary with timing status; and
- a Presenter preview that shows how the selected script block will look while delivering.

The overview provides direct entry points to **Edit script**, **Edit setup**, import review, and session review. It should make the current deck, script, timing, cues, and delivery preview understandable at a glance without forcing the user into Presenter mode. **Start presentation** opens the private Presenter tab and then guides the user to open the audience presentation window.

On narrow screens, the same information becomes ordered sections or tabs; the sidebar collapses into a presentation switcher, but **Add presentation**, project actions, and **Start presentation** remain directly reachable.

### 14.2 Import review

The import review should show what the system understood before script generation begins. The user should be able to correct slide order, add missing context, and acknowledge unsupported elements.

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
- PDF import;
- image import;
- basic PPTX or PowerPoint import if it can be rendered reliably;
- static slide rendering with no animation support;
- slide order and import validation;
- a pre-generation session setup form with editable defaults for duration, Q&A time, speaking rate, word budget, script depth, and cue density;
- script generation grounded in slide content;
- a central script generation and editing surface;
- a dedicated teleprompter script editor with slide-by-slide editing, reading markers, timing, fallback versions, and Presenter-mode preview;
- regenerate, shorten, expand, and change-tone actions;
- AI-inferred deck context plus a user-stated presentation goal in setup;
- a synchronized presenter mode;
- manual next, previous, jump, and reset controls;
- smooth manual and automatic teleprompter scrolling;
- automatic next-slide behavior when the current script completes, with a user setting to disable it;
- current-slide and next-slide context;
- timer and progress display;
- at least a small set of delivery cues;
- local project persistence;
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

The current application is a web-based interface with server-backed AI generation and local persistence. The product direction should preserve the ability to evolve toward a desktop shell because multiple windows, global shortcuts, local file access, and presentation sharing are central to the experience.

### Client responsibilities

- import selection and drag-and-drop;
- presentation and slide navigation;
- teleprompter script editor state, editing, and preview;
- presenter state and controls;
- teleprompter scrolling;
- cue visibility and personalization;
- local draft persistence;
- presenter-session timer and event recording; and
- presentation-window and private-window coordination.

### Server or worker responsibilities

- file ingestion and validation;
- extraction of slide text and images;
- OCR fallback;
- visual analysis;
- script generation;
- targeted rewrite actions;
- structured output validation;
- simple generation-state and error reporting without exposing partial output; and
- optional account, storage, and sync services later.

### Canonical data model

The canonical project model should separate source content from generated content:

~~~text
Project
  id
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

The presenter state should be separate from saved script content so a temporary live position does not accidentally overwrite the project.

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

- add the pre-generation session setup form;
- add editable defaults for duration, speaking rate, and cue density;
- calculate and display raw and usable word budgets;
- add the AI brief and generation review summary;
- infer deck context and collect the user's presentation goal;
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

- test common meeting platforms and display arrangements;
- handle lost focus, closed windows, slow imports, and AI failures;
- add deletion, export, and backup behavior;
- improve onboarding and sharing preflight;
- measure import-to-Presenter-mode completion;
- run user testing with introverted and low-stimulation presenters.

**Success criterion:** A first-time user can complete import, script review, and a private Presenter-mode workflow without live assistance.

## 21. Validation plan

Test the smallest valuable loop with 5 to 10 presenters who identify with the target audience:

1. Import an existing presentation.
2. Review the extracted slides.
3. Generate a script.
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
- Should local-first persistence be the default, with optional cloud sync later?
- Which multimodal model and file-processing path can meet privacy expectations?
- Is the default output a full script, concise notes, or a user-selected mode?
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
