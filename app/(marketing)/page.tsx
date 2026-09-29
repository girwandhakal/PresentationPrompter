import type { Metadata } from "next";
import Image from "next/image";
import editor from "@/public/landing/editor.webp";
import presenter from "@/public/landing/presenter.webp";
import review from "@/public/landing/review.webp";
import setup from "@/public/landing/setup.webp";
import { Clip, StagePair } from "../components/landing/Clip";
import { LandingCta } from "../components/landing/LandingCta";
import { Steps } from "../components/landing/Steps";
import { Words } from "../components/landing/Words";

export const metadata: Metadata = {
  title: { absolute: "Cueframe · Know what to say on every slide" },
  description: "Bring the slides you already made. Cueframe writes a script for each one and gives you a teleprompter only you can see.",
};

const STEPS = [
  {
    title: "Add your slides",
    body: "A PDF, a PowerPoint file, or slide images. Cueframe reads every slide and suggests a goal and an audience. Change them, or go straight to writing.",
    image: setup,
    alt: "Cueframe's setup page with six imported slides, a goal, an audience, and a Write my script button.",
  },
  {
    title: "Get a script for every slide",
    body: "Plain sentences you can say out loud, drawn from what your slides and notes actually say. It opens with a greeting and closes with thanks.",
    image: editor,
    alt: "The script editor showing slide 2 of a presentation about street trees, with its spoken script beside the slide.",
  },
  {
    title: "Present from a private teleprompter",
    body: "Your script scrolls at your pace in one window. Your audience sees the slides in another.",
    image: presenter,
    alt: "The teleprompter in presenting mode, with large script text, a reading line, the current slide, and the next slide.",
  },
];

const STAGE_POINTS = [
  { title: "A reading line keeps your place", body: "Look up at the room, look back, and pick up where you left off." },
  { title: "Scrolls at your pace", body: "Speed it up, slow it down, or scroll by hand. Space pauses." },
  { title: "Clickers just work", body: "Page Up and Page Down move both windows together." },
  { title: "Blank the room's screen", body: "Press B to take a question without your slide in the way." },
  { title: "Advance on your terms", body: "At the end of a slide, Cueframe offers the next one. Stay put with one click." },
  { title: "A clock that knows your plan", body: "Time on this slide and time left for the talk, at a glance." },
];

const FAQ = [
  { q: "What files can I use?", a: "PDF, PowerPoint (.pptx), or slide images (PNG, JPG, WebP). For PowerPoint files, exporting a PDF gives the most exact visuals, because charts and layouts from .pptx are shown as a simplified preview." },
  { q: "Does Cueframe change my slides?", a: "No. Your slides are shown exactly as they are, one image per slide. Animations and transitions aren't played." },
  { q: "Will the script sound like me?", a: "Tell it your goal, your audience, and how much detail you want, and paste a few sentences in your own voice if you like. Then change any word. The script is yours to edit." },
  { q: "Can my audience see my script?", a: "No. The audience window only receives slide images. In Zoom, Teams, or Meet, share that window rather than your whole screen, because sharing an entire screen shows everything on it." },
  { q: "What does it cost?", a: "Nothing during the pilot. Each account has a daily limit on scripts written, so everyone gets a fair share." },
  { q: "Why can't I create an account?", a: "The pilot has a small number of accounts. When it's full, sign-in says so. If you already have an account, you can always sign in." },
];

export default function LandingPage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap">
          <h1 id="hero-title" className="hero__title">
            <span className="hero__line hero__line--read"><Words text="Know what to say" className="hero__word" /></span>
            <span className="hero__line hero__line--current"><Words text="on every slide." from={4} className="hero__word" /></span>
            <span className="reading-line" aria-hidden="true" />
          </h1>
          <div className="hero__row">
            <p className="hero__lede">
              Bring the slides you already made. Cueframe writes a script for each one in plain spoken language, then gives you a teleprompter only you can see. Your audience sees just the slides.
            </p>
            <div className="hero__action">
              <LandingCta />
              <p className="hero__fine">Free during the pilot. Works with PDF, PowerPoint, and images.</p>
            </div>
          </div>
          <Clip
            eager
            className="frame hero__clip"
            src="/landing/hero.mp4"
            poster="/landing/hero-poster.webp"
            width={1440}
            height={900}
            label="Recording: a six-slide PDF is added, the audience is filled in, and Cueframe writes a script for every slide."
          />
        </div>
      </section>

      <section className="problem" aria-labelledby="problem-title">
        <div className="wrap problem__grid">
          <h2 id="problem-title"><Words text="The slides are done. The talking is the hard part." /></h2>
          <ul className="problem__list">
            <li><strong>The blank notes box.</strong> It&apos;s the night before, and you know the slides but not the sentences.</li>
            <li><strong>Reading bullets aloud.</strong> Slide text is written to be read, so saying it word for word sounds stiff.</li>
            <li><strong>Losing your place.</strong> One question, one glance at the room, and the next line is gone.</li>
          </ul>
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="wrap">
          <header className="section__head">
            <h2 id="how-title"><Words text="From deck to delivery in three steps" /></h2>
          </header>
          <Steps steps={STEPS} />
        </div>
      </section>

      <section className="section section--split" aria-labelledby="edit-title">
        <div className="wrap split">
          <div className="split__text">
            <h2 id="edit-title"><Words text="It's your script. Edit it like a document." /></h2>
            <ul className="checks">
              <li>Bold the words you want to stress.</li>
              <li>Add cues only you will see, like <span className="cue-sample">Point at the orange bar</span>.</li>
              <li>Ask for a shorter, simpler, or more natural version. Nothing changes until you accept it.</li>
              <li>Every edit saves as you type, and earlier versions stay in history.</li>
            </ul>
          </div>
          <Clip
            className="frame split__media"
            src="/landing/edit.mp4"
            poster="/landing/edit-poster.webp"
            width={1440}
            height={900}
            label="Recording: in the editor, a phrase is made bold, a private cue is added, and a suggested rewrite is previewed and then discarded."
          />
        </div>
      </section>

      <section id="stage" className="stage theme-dark" aria-labelledby="stage-title">
        <div className="wrap">
          <header className="stage__head">
            <h2 id="stage-title"><Words text="Two screens. Only one of them is yours." /></h2>
            <p>Share the audience window in Zoom, Teams, or Meet, or send it to the projector. Your script, cues, and notes never reach it.</p>
          </header>
          <StagePair
            presenterCaption="Only you see this"
            audienceCaption="Your audience sees this"
            presenter={{ src: "/landing/stage-presenter.mp4", poster: "/landing/stage-presenter-poster.webp", width: 1440, height: 900, label: "Recording of the presenter window: the script scrolls past a reading line, then moves to the next slide." }}
            audience={{ src: "/landing/stage-audience.mp4", poster: "/landing/stage-audience-poster.webp", width: 1280, height: 720, label: "Recording of the audience window at the same moment: only the slides, which change and briefly go blank." }}
          />
          <ul className="stage__points">
            {STAGE_POINTS.map((point) => (
              <li key={point.title}>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--split" aria-labelledby="review-title">
        <div className="wrap split split--reverse">
          <div className="split__text">
            <h2 id="review-title"><Words text="See where the time went." /></h2>
            <p className="section__lede">After each run, Cueframe compares every slide to your plan. You&apos;ll know which slide to trim before the real thing, not during it.</p>
          </div>
          <div className="frame split__media">
            <Image src={review} alt="Session review: 7 minutes 44 seconds against an 8-minute plan, with each slide's time over or under plan." sizes="(max-width: 900px) 100vw, 60vw" placeholder="blur" />
          </div>
        </div>
      </section>

      <section id="privacy" className="section privacy" aria-labelledby="privacy-title">
        <div className="wrap">
          <header className="section__head">
            <h2 id="privacy-title"><Words text="Private by default" /></h2>
          </header>
          <dl className="privacy__list">
            <div><dt>Your account, your presentations</dt><dd>Presentations belong to your Google account. No one else can open them.</dd></div>
            <div><dt>Slides only for the room</dt><dd>The audience window receives slide images and nothing else.</dd></div>
            <div><dt>What the AI sees</dt><dd>Slide content is sent to the AI service to read your slides and write or revise your script.</dd></div>
            <div><dt>Take it with you, or delete it</dt><dd>Export any script as text. Deleting a presentation is permanent, since the pilot keeps no backups.</dd></div>
          </dl>
        </div>
      </section>

      <section id="questions" className="section" aria-labelledby="faq-title">
        <div className="wrap faq">
          <h2 id="faq-title"><Words text="Questions" /></h2>
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

      <section className="closing" aria-labelledby="closing-title">
        <div className="wrap closing__inner">
          <h2 id="closing-title"><Words text="Walk in knowing what to say." /></h2>
          <LandingCta />
        </div>
      </section>
    </>
  );
}
