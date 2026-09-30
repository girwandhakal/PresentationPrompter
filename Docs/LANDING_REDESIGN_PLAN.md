# Landing page redesign plan

Drafted 2026-09-29; implemented 2026-09-30 on `feat/landing-redesign`.

Decisions taken when building (they override the proposal below where they differ):
- No founder note (section 8 dropped at the owner's request).
- No section eyebrows such as `( The problem )`, including the hero's; headings stand alone.
- The action stays Pitch on light and Powder on dark; Bluebell keeps its presenter-private meaning
  (reading line, "Only you see this"), per CLAUDE.md, instead of becoming the CTA colour (D1).
- Instrument Serif is added for the public site only, via `next/font` (self-hosted at build).
  Inter Display was not added; headings use the existing Inter with tighter tracking (D2).
- "Limited time" stays open-ended (D4); no live seat counter (D5); no pilot bar dismissal.
- New media: a coded live teleprompter in the features grid (`app/components/landing/Prompter.tsx`)
  and a regenerated `public/og.png`. The existing product recordings are reused.
- Displayed limits live in `lib/pilot.ts`; `tests/unit/pilot.test.ts` keeps them equal to the
  enforced defaults.

Goal: replace the current landing page (`app/(marketing)/`) with a from-scratch, YC-style SaaS
page that sells Cueframe as a **free, limited-time pilot** with limited seats and limited usage,
using a new arrangement of the Cueframe palette.

## 1. What the references teach

| Source | What to take | What to leave |
| --- | --- | --- |
| **YC guide** (The VC Corner, "Win the first 5 seconds") | Outcome headline ("outcome for X without pain Y"), one primary CTA, risk reducer beside every CTA, 10–60 s micro-demo in the hero, problem → transformation, 3 steps, transparent pricing with usage fences, 3–5 FAQ beside pricing, fast load, no carousels, plain words | Logo strips, testimonials, "Most popular" tiers and decoy pricing. We have no customers or paid tiers yet, and the guide itself says never fake proof |
| **Veld** (getveld.framer.website) | Dark-first page (near-black `#080502` base, warm off-white text, one hot accent on CTAs), Inter Display headline at 48 px/500 with tight tracking (−0.03 em), 34 px/400 section titles, small 4 px CTA radius, nav with section anchors + CTA, "Why us" comparison table, 3-step section, FAQ accordion | Six-card benefit grid, fake quantified testimonials, monthly/yearly toggle |
| **Meadowmind** (meadowmind.framer.ai) | Calm light sections, numbered steps (`/01 /02 /03`), serif accent for step titles (Instrument Serif), a quiet promise-driven tone suited to anxious users | Pills everywhere, 24 px card radius, 3-tier pricing |
| **Agarimo** (agarimo.framer.website) | Editorial restraint: huge whitespace, bracketed serif eyebrows (`( Services )`), warm tinted light background with deep-brown ink, a real founder/team presence as trust | Portfolio/collection layout |

Shared DNA to adopt: **Inter Display + one serif accent, two-tone page (dark hero/close, warm
light middle), one accent colour reserved for the action, generous vertical rhythm, static
layouts.**

## 2. Positioning and copy

**Offer:** Free pilot, limited seats, limited daily use, while it lasts.

**Headline (outcome formula):**
> Know what to say on every slide.
> *without reading your bullets aloud.* (serif italic second line)

Alternates to A/B later: "Turn your slides into a script you can actually say." /
"Your slides are done. Now you'll know what to say."

**Subhead (one sentence, ≤25 words):** Upload the deck you already made. Cueframe writes a
natural script for each slide and gives you a teleprompter only you can see.

**Primary CTA (the only one):** `Join the free pilot` → Google sign-in (existing `LandingCta`
logic). Signed in: `Open your presentations`.

**Risk reducer under every CTA:**
> Free during the pilot · No card · Limited seats\*

**The asterisk footnote** (shown under the hero CTA, repeated in the pricing card and footer):
> \*The pilot is limited to 10 accounts and up to 5 scripts per account per day. Limits may
> change and the pilot may end; you'll be told before it does.

Copy must match what the server enforces. Today that is: 10 accounts
(`functions/src/index.ts` `DEFAULT_MAX_ACCOUNTS`), 5 generations/user/day and a daily token cap
(`lib/ai/server/quota.ts` `DEFAULT_LIMITS`), 120 slides/deck (`lib/import/types.ts`
`MAX_SLIDES`). The product overview's 20-slide / 5-project figures are **not** enforced yet, so
don't advertise them. Put the displayed numbers in one shared module (`lib/pilot.ts`) that the
quota code also reads, so copy cannot drift from the enforced limit.

"Limited time": we have no end date. Use "for a limited time" / "while the pilot runs" unless
you give me a date. No countdown timers or invented scarcity.

## 3. Colour system (new arrangement, same three colours)

The palette stays Powder `#FCE4D8`, Pitch `#070600`, Blue Bell `#279AF1` (fixed in
`tokens.css`). The new scheme changes their **roles** on the marketing page only, scoped under
`.mk` so the workspace is untouched.

| Role | Value | Where |
| --- | --- | --- |
| Ink / dark canvas | Pitch `#070600` | Hero, "Two screens" band, final CTA, footer |
| Dark raised surface | Pitch 90% + Powder | Product frames, table header on dark |
| Warm light canvas | Powder 45% + white | Problem, steps, pricing, FAQ (the Agarimo/Meadowmind calm middle) |
| Light raised surface | white with Pitch 8% hairline | Pricing card, table |
| Text on dark | Powder `#FCE4D8` / Powder 65% for secondary | Veld's warm off-white instead of pure white |
| Text on light | Pitch / Pitch 64% | |
| **Action** | Blue Bell fill, Pitch text | The single CTA, focus ring, the one highlighted word in the hero |
| Private highlight | Blue Bell line/tint | Reading line in the teleprompter demo, "Only you see this" labels |

Blue Bell with Pitch text is ~6.7:1 (AA at every size); white text on Blue Bell is ~3:1 and fails, so
never use it. Blue Bell in the app means "presenter-private"; on the landing page it doubles as
the CTA colour and the story ("the blue part is yours"). If you'd rather keep Blue Bell strictly
private, the fallback is Powder CTA on dark / Pitch CTA on light — see decision D1.

## 4. Typography

- **Display:** Inter Display (optical-size cut of Inter, OFL). Self-host one variable woff2 next
  to `public/fonts/inter-latin…woff2`. H1 clamp(40px, 6vw, 72px)/1.02, weight 500,
  tracking −0.035em. H2 clamp(30px, 4vw, 44px)/1.1, weight 450.
- **Serif accent:** Instrument Serif italic (OFL), self-hosted, used only for the hero's second
  line, section eyebrows like `( How it works )`, and step titles. Never for body text.
- **Body/UI:** existing Inter, 17 px body on the landing, 15 px nav.

This adds two font files to the landing route only (`landing.css` `@font-face`, `preload` the
display cut). The workspace keeps its single-family rule. Decision D2.

## 5. Page structure (top to bottom)

All sections static; no carousels, no auto-sliding. Container max 1120 px, 16 px mobile gutter,
section padding clamp(72px, 10vw, 136px).

0. **Pilot bar** (dark, 36 px, dismissible, remembered in `localStorage` with try/catch):
   "Free pilot now open, limited seats\*. Join →". Clicking scrolls to pricing.
1. **Nav** (sticky, Pitch at 85% with backdrop blur only when scrolled): brand mark, anchors
   `How it works · Features · Pricing · FAQ`, text link `Sign in`, primary `Join the free pilot`.
   Mobile: brand + CTA, anchors collapse into a `<details>` menu.
2. **Hero** (dark): serif eyebrow `( Free pilot · limited seats )`, H1, subhead, CTA + risk
   reducer + asterisk note, then the **micro-demo**: the existing `hero.mp4` (import → script)
   inside a plain product frame, autoplay muted loop with a visible pause button and poster.
   Below it, a **compatibility strip** in place of a logo strip: "Works with PDF · PowerPoint ·
   PNG/JPG · share into Zoom, Teams, or Meet". Plain text, no third-party logos.
3. **Problem → transformation** (light): H2 "The slides are done. The talking is the hard part."
   Three before/after rows: blank notes box → a script for every slide; reading bullets aloud →
   plain spoken sentences; losing your place → a reading line that holds it.
4. **How it works** (light): eyebrow `( How it works )`, three numbered columns `/01 /02 /03`
   (Add your slides · Get a script for every slide · Present privately) each with a still
   screenshot (`setup.webp`, `editor.webp`, `presenter.webp`). Static grid, stacks on mobile.
5. **Two screens** (dark band): H2 "Two screens. Only one of them is yours." Existing
   presenter/audience recordings side by side with Blue Bell "Only you see this" and neutral
   "Your audience sees this" labels. One line on selected-window sharing (required privacy
   teaching).
6. **Features grid** (light, 2×2 bento with 14 px radius, hairline borders, no shadows):
   Edit like a document (edit.mp4), Present at your pace (reading line, clicker, blank screen),
   See where the time went (`review.webp`), Private by default (short list).
7. **Why Cueframe** (light): Veld-style comparison table, three columns: *Speaker notes box* ·
   *Reading your slides* · **Cueframe**. Rows: sounds natural, keeps your place, hidden from the
   audience, fits your time, editable. Honest cells (text, not only ticks), accessible `<table>`.
8. **Founder note** (light, replaces testimonials): short first-person paragraph on why Cueframe
   exists, name and photo, Agarimo-style. Needs real text from you (D3). When pilot users give
   permission, real quotes can replace or join it. No invented quotes, logos, or usage counts.
9. **Pricing** (light, `id="pricing"`): two columns.
   - Left: **Pilot** card: `$0` / "for a limited time", badge "Limited seats", included list
     (script for every slide, private teleprompter, editor with history, timing review, export),
     fences (10 accounts, 5 scripts/day), CTA, asterisk text.
   - Right: **mini-FAQ** (3–4 items, per the guide): What happens when the pilot ends? · What
     are the limits? · What if the pilot is full? · Is my deck private?
   - Optional muted "After the pilot" line: "Paid plans later. Pilot members hear first." No
     invented prices.
10. **FAQ** (light, `id="faq"`): the existing six answers, rewritten tighter, native
    `<details>`, plus FAQPage JSON-LD.
11. **Final CTA** (dark): "Walk in knowing what to say." CTA + risk reducer.
12. **Footer** (dark): brand, Privacy, Your presentations, the asterisk text, © year.

## 6. Motion

The guide's evidence says clarity beats motion, and the repo rules forbid animated hover
transforms. Keep: a 400 ms fade/rise of hero text on load, a one-time reveal of section heads
via CSS `animation-timeline: view()` with a static fallback, video autoplay. Drop: word-by-word
headline splitting (`Words.tsx`) and scroll-linked staging from PR #35. Everything off under
`prefers-reduced-motion`, and videos show the poster and don't autoplay.

## 7. Implementation

Branch `feat/landing-redesign` in a worktree (the main checkout is shared).

| Step | Files |
| --- | --- |
| 1. Pilot constants shared with quota code | new `lib/pilot.ts`; `lib/ai/server/quota.ts`, `functions/src/index.ts` read defaults from it (or a test asserts they match, if `functions/` can't import app code) |
| 2. Strip old design | delete `app/styles/landing.css`, `app/components/landing/{Steps,Words}.tsx`; keep the media in `public/landing/` and capture scripts |
| 3. Fonts and scoped tokens | new `app/styles/marketing.css` (`.mk` tokens, `@font-face`, layout); font files in `public/fonts/` |
| 4. Components | `app/components/landing/`: `PilotBar`, `SiteNav`, `Hero`, `DemoVideo` (rewrite of `Clip`, same pause/poster/reduced-motion behaviour), `Problem`, `Steps`, `TwoScreens`, `Features`, `Compare`, `FounderNote`, `Pricing`, `Faq`, `FinalCta`, `SiteFooter`. Reuse `ui/button` for all buttons |
| 5. CTA | `LandingCta.tsx`: label "Join the free pilot", Blue Bell variant on marketing only, pilot-full error message unchanged |
| 6. Pages | rewrite `app/(marketing)/page.tsx` and `layout.tsx`; restyle `privacy/page.tsx` on the new tokens (it currently shares `landing.css`) |
| 7. Metadata and OG | title "Cueframe · Free pilot: know what to say on every slide"; regenerate `public/og.png` with `scripts/landing/og.mjs` in the new scheme |
| 8. Tests | update `tests/e2e/landing.spec.ts` (new H1, one primary CTA, asterisk text visible, pricing and FAQ open, footer privacy link); add a unit test that the rendered limits equal the enforced limits |

## 8. Verification

- `npm run dev:demo`, check at 375, 768, 1280, 1920 px; 200% text zoom; keyboard-only path
  from pilot bar to CTA; visible focus on dark and light.
- Reduced motion, missing/blocked video, long German-length strings, signed-in state, sign-in
  error, pilot-full error.
- Contrast: every text/background pair ≥ 4.5:1 (Blue Bell only with Pitch text).
- Performance: LCP < 2 s on production build (`npm run preview`); hero poster preloaded, videos
  `preload="metadata"`, only one video autoplaying above the fold.
- `npm run check` and `npm run test:e2e`. Playwright screenshots of desktop and mobile for
  review before the PR.

## 9. Decisions I need from you

- **D1 CTA colour:** Blue Bell CTA (recommended, most "SaaS", conflicts with blue = private in
  the app) or Powder/Pitch CTA (keeps blue strictly private).
- **D2 Fonts:** add Inter Display + Instrument Serif on the landing page only (recommended), or
  stay Inter-only.
- **D3 Founder note:** your name, photo, and 2–3 sentences, or drop the section.
- **D4 Pilot end:** a real end date for "limited time", or keep it open-ended.
- **D5 Live seat counter:** "7 of 10 seats left" is persuasive but needs a small public
  read-only endpoint over the admission counter. Ship later or skip; the page works without it.
