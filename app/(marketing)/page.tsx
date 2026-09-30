import { ArrowRight, Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import editor from "@/public/landing/editor.webp";
import presenter from "@/public/landing/presenter.webp";
import review from "@/public/landing/review.webp";
import setup from "@/public/landing/setup.webp";
import { PILOT, PILOT_TERMS } from "@/lib/pilot";
import { Clip, StagePair } from "../components/landing/Clip";
import { LandingCta } from "../components/landing/LandingCta";
import { Prompter } from "../components/landing/Prompter";

export const metadata: Metadata = {
  title: { absolute: "Cueframe · Know what to say on every slide" },
  description: "Turn the slides you already made into a script you can say out loud, then present from a teleprompter only you can see. Free during the pilot.",
};

const PROBLEMS = [
  { before: "A blank notes box the night before.", after: "A script for every slide, drawn from your slides and notes." },
  { before: "Reading bullets aloud, word for word.", after: "Plain sentences written to be spoken." },
  { before: "One question, and your place is gone.", after: "A reading line that keeps it for you." },
];

const STEPS = [
  {
    title: "Add your slides",
    body: "A PDF, a PowerPoint file, or slide images. Set a goal and an audience, or go straight to writing.",
    image: setup,
    alt: "Cueframe's setup page with six imported slides, a goal, an audience, and a Write my script button.",
  },
  {
    title: "Get a script for every slide",
    body: "Drawn from what your slides and notes actually say. Change any word.",
    image: editor,
    alt: "The script editor showing slide 2 of a presentation about street trees, with its spoken script beside the slide.",
  },
  {
    title: "Present privately",
    body: "Your script scrolls at your pace in one window. Your audience sees only the slides.",
    image: presenter,
    alt: "The teleprompter in presenting mode, with large script text, a reading line, the current slide, and the next slide.",
  },
];

type Cell = { yes: boolean; text: string };
const COMPARE: { row: string; notes: Cell; slides: Cell; cueframe: Cell }[] = [
  { row: "Sounds like talking", notes: { yes: false, text: "If you wrote them well" }, slides: { yes: false, text: "Sounds read" }, cueframe: { yes: true, text: "Written to be spoken" } },
  { row: "Keeps your place", notes: { yes: false, text: "Small text, easy to lose" }, slides: { yes: false, text: "Eyes on the screen" }, cueframe: { yes: true, text: "A reading line holds it" } },
  { row: "Hidden from the room", notes: { yes: true, text: "In presenter view" }, slides: { yes: false, text: "Everyone sees it" }, cueframe: { yes: true, text: "Only in your window" } },
  { row: "Fits your time", notes: { yes: false, text: "Up to you" }, slides: { yes: false, text: "Rarely" }, cueframe: { yes: true, text: "Planned to your time" } },
  { row: "Ready in minutes", notes: { yes: false, text: "You write every word" }, slides: { yes: true, text: "Nothing to write" }, cueframe: { yes: true, text: "A draft for every slide" } },
];

const INCLUDED = [
  "A script for every slide",
  "A private teleprompter and audience window",
  "An editor with cues, rewrites, and history",
  "Timing review after every run",
  "Export as Markdown or plain text",
];

const PRICING_FAQ = [
  { q: "Is it really free?", a: "Yes. There's nothing to pay during the pilot, and no card to enter." },
  { q: "What are the limits?", a: `Up to ${PILOT.dailyScripts} scripts per account per day, and ${PILOT.accounts} accounts in the pilot. Daily limits reset at midnight UTC.` },
  { q: "What if the pilot is full?", a: "Sign-in says so, and no new accounts are created. If you already have an account, you can always sign in." },
  { q: "What happens when it ends?", a: "Export any script as Markdown or plain text at any time, so your work isn't locked in." },
];

const FAQ = [
  { q: "What files can I use?", a: "PDF, PowerPoint (.pptx), or slide images (PNG, JPG, WebP). For PowerPoint files, exporting a PDF gives the most exact visuals, because charts and layouts from .pptx are shown as a simplified preview." },
  { q: "Does Cueframe change my slides?", a: "No. Your slides are shown exactly as they are, one image per slide. Animations and transitions aren't played." },
  { q: "Will the script sound like me?", a: "Tell it your goal, your audience, and how much detail you want, and paste a few sentences in your own voice if you like. Then change any word. The script is yours to edit." },
  { q: "Can my audience see my script?", a: "No. The audience window only receives slide images. In Zoom, Teams, or Meet, share that window rather than your whole screen, because sharing an entire screen shows everything on it." },
  { q: "What does the AI see?", a: "Slide content and your settings are sent to an AI service to read your slides and write or revise your script, and for nothing else." },
  { q: "Can I delete my work?", a: "Yes. Deleting a presentation is permanent. The pilot keeps no backups, so deleted work can't be recovered." },
];

const FAQ_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [...PRICING_FAQ, ...FAQ].map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
}).replace(/</g, "\\u003c");

function Reassurance() {
  return <p className="reassure">Free during the pilot <span aria-hidden="true">·</span> No card <span aria-hidden="true">·</span> Limited seats*</p>;
}

function Mark({ cell }: { cell: Cell }) {
  return (
    <span className="compare__cell" data-yes={cell.yes || undefined}>
      {cell.yes ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
      {cell.text}
    </span>
  );
}

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_SCHEMA }} />

      <section className="hero theme-dark" aria-labelledby="hero-title">
        <div className="mk-wrap hero__inner">
          <h1 id="hero-title" className="hero__title">
            Know what to say <em>on every slide.</em>
          </h1>
          <p className="hero__lede">
            Turn the slides you already made into a script you can say out loud. Then present from a teleprompter only you can see.
          </p>
          <div className="hero__action">
            <LandingCta />
            <Reassurance />
          </div>
          <div className="hero__demo">
            <Clip
              eager
              className="frame"
              src="/landing/hero.mp4"
              poster="/landing/hero-poster.webp"
              width={1440}
              height={900}
              label="Recording: a six-slide PDF is added, the audience is filled in, and Cueframe writes a script for every slide."
            />
          </div>
          <p className="hero__works">
            <span>Works with PDF, PowerPoint, and slide images</span>
            <span aria-hidden="true" className="hero__dot" />
            <span>Share into Zoom, Teams, or Meet</span>
          </p>
        </div>
      </section>

      <section className="band tone-light" aria-labelledby="problem-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="problem-title">The slides are done. The talking is the hard part.</h2>
          </header>
          <ul className="problems">
            {PROBLEMS.map((item) => (
              <li key={item.before}>
                <p className="problems__before">{item.before}</p>
                <ArrowRight className="problems__arrow" aria-hidden="true" />
                <p className="problems__after">{item.after}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="band tone-paper" aria-labelledby="how-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="how-title">From deck to delivery in three steps.</h2>
          </header>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <div className="frame steps__shot">
                  <Image src={step.image} alt={step.alt} sizes="(max-width: 860px) 100vw, 33vw" placeholder="blur" />
                </div>
                <p className="steps__number" aria-hidden="true">/0{index + 1}</p>
                <h3>{step.title}</h3>
                <p className="steps__body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band theme-dark stage" aria-labelledby="stage-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="stage-title">Two screens. Only one of them is yours.</h2>
            <p className="band__lede">Share the audience window in Zoom, Teams, or Meet, or send it to the projector. Your script and cues never reach it. Share that window, not your whole screen.</p>
          </header>
          <StagePair
            presenterCaption="Only you see this"
            audienceCaption="Your audience sees this"
            presenter={{ src: "/landing/stage-presenter.mp4", poster: "/landing/stage-presenter-poster.webp", width: 1440, height: 900, label: "Recording of the presenter window: the script scrolls past a reading line, then moves to the next slide." }}
            audience={{ src: "/landing/stage-audience.mp4", poster: "/landing/stage-audience-poster.webp", width: 1280, height: 720, label: "Recording of the audience window at the same moment: only the slides, which change and briefly go blank." }}
          />
        </div>
      </section>

      <section id="features" className="band tone-light" aria-labelledby="features-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="features-title">Everything between the last slide and the first word.</h2>
          </header>
          <div className="bento">
            <article className="tile tile--wide">
              <div className="tile__text">
                <h3>Edit it like a document</h3>
                <p>Bold the words to stress, add cues only you see, and ask for a shorter or simpler version. Nothing changes until you accept it.</p>
              </div>
              <Clip
                className="frame tile__media"
                src="/landing/edit.mp4"
                poster="/landing/edit-poster.webp"
                width={1440}
                height={900}
                label="Recording: in the editor, a phrase is made bold, a private cue is added, and a suggested rewrite is previewed and then discarded."
              />
            </article>
            <article className="tile tile--dark theme-dark">
              <div className="tile__text">
                <h3>Present at your pace</h3>
                <p>The script scrolls as fast as you talk. Clickers move both windows, and B blanks the room&apos;s screen.</p>
              </div>
              <Prompter />
            </article>
            <article className="tile">
              <div className="tile__text">
                <h3>See where the time went</h3>
                <p>After each run, every slide is compared to your plan, so you know what to trim before the real thing.</p>
              </div>
              <div className="frame tile__media">
                <Image src={review} alt="Session review: 7 minutes 44 seconds against an 8-minute plan, with each slide's time over or under plan." sizes="(max-width: 860px) 100vw, 40vw" placeholder="blur" />
              </div>
            </article>
            <article className="tile tile--wide">
              <div className="tile__text">
                <h3>Private by default</h3>
                <p>Presentations belong to your Google account, and no one else can open them.</p>
              </div>
              <ul className="tile__list">
                <li><Check aria-hidden="true" />The audience window receives slide images only</li>
                <li><Check aria-hidden="true" />Cues and notes stay in your window</li>
                <li><Check aria-hidden="true" />Export any script as Markdown or plain text</li>
                <li><Check aria-hidden="true" />Delete a presentation whenever you like</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="band tone-paper" aria-labelledby="compare-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="compare-title">Better than the notes box.</h2>
          </header>
          <table className="compare">
            <thead>
              <tr>
                <td />
                <th scope="col">Speaker notes</th>
                <th scope="col">Reading your slides</th>
                <th scope="col" className="compare__us">Cueframe</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((item) => (
                <tr key={item.row}>
                  <th scope="row">{item.row}</th>
                  <td data-label="Speaker notes"><Mark cell={item.notes} /></td>
                  <td data-label="Reading your slides"><Mark cell={item.slides} /></td>
                  <td data-label="Cueframe" className="compare__us"><Mark cell={item.cueframe} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="pricing" className="band tone-powder" aria-labelledby="pricing-title">
        <div className="mk-wrap">
          <header className="band__head">
            <h2 id="pricing-title">Free while the pilot runs.</h2>
          </header>
          <div className="pricing">
            <article className="plan" aria-labelledby="plan-title">
              <div className="plan__head">
                <h3 id="plan-title">Pilot</h3>
                <span className="plan__tag">Limited seats*</span>
              </div>
              <p className="plan__price"><span>$0</span> for a limited time</p>
              <ul className="plan__list">
                {INCLUDED.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}
              </ul>
              <ul className="plan__limits">
                <li>Up to {PILOT.dailyScripts} scripts per day*</li>
                <li>{PILOT.accounts} accounts in the pilot*</li>
              </ul>
              <LandingCta />
              <p className="plan__terms">*{PILOT_TERMS}</p>
            </article>
            <div className="mini-faq">
              {PRICING_FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="band tone-light" aria-labelledby="faq-title">
        <div className="mk-wrap faq">
          <header className="band__head">
            <h2 id="faq-title">Questions</h2>
          </header>
          <div className="faq__list">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="closing theme-dark" aria-labelledby="closing-title">
        <div className="mk-wrap closing__inner">
          <h2 id="closing-title">Walk in knowing <em>what to say.</em></h2>
          <LandingCta />
          <Reassurance />
        </div>
      </section>
    </>
  );
}
