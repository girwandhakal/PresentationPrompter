"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  FileText,
  Gauge,
  Keyboard,
  LayoutGrid,
  Lightbulb,
  Maximize2,
  MessageSquareText,
  Mic2,
  Monitor,
  MoreHorizontal,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type View = "dashboard" | "studio" | "present";

type Slide = {
  title: string;
  eyebrow: string;
  body: string;
  cue: string;
  duration: string;
  speakerNote: string;
  accent: string;
};

const initialSlides: Slide[] = [
  {
    title: "Reimagining the way teams meet",
    eyebrow: "Opening",
    body:
      "Good morning, everyone. I want to start with a simple observation: our meetings have become the operating system of work, but the way we prepare for them has barely changed. Today, I’ll show you a calmer, more intelligent way forward.",
    cue: "Pause after “simple observation.” Make eye contact before revealing the idea.",
    duration: "0:42",
    speakerNote: "Set a confident, conversational tone.",
    accent: "#9ed9ff",
  },
  {
    title: "The cost of fragmented attention",
    eyebrow: "The problem",
    body:
      "The average knowledge worker moves between six different tools just to prepare for one important conversation. That fragmentation creates more than wasted time. It creates uncertainty, weaker decisions, and a room full of people who are only half present.",
    cue: "Gesture toward each metric from left to right. Slow down on “half present.”",
    duration: "0:55",
    speakerNote: "Let the numbers carry the argument.",
    accent: "#dff3ff",
  },
  {
    title: "One focused workspace",
    eyebrow: "The solution",
    body:
      "Cueframe brings the entire preparation loop into one focused workspace. Your slides, your narrative, your timing, and your delivery cues move together. The technology stays quiet, so the person presenting can be fully present.",
    cue: "Open your hands on “one focused workspace.”",
    duration: "0:48",
    speakerNote: "This is the key product reveal.",
    accent: "#b8e5ff",
  },
  {
    title: "A market ready for a better ritual",
    eyebrow: "The opportunity",
    body:
      "This is not a niche behavior. Millions of people present every day across sales, education, leadership, and fundraising. They already invest in better slides. The next category is helping them deliver those ideas with the same level of craft.",
    cue: "Build energy through the four audience segments.",
    duration: "1:05",
    speakerNote: "Connect the market to everyday behavior.",
    accent: "#92d5ff",
  },
  {
    title: "Let every idea land",
    eyebrow: "Closing",
    body:
      "The best presentations do more than transfer information. They create clarity, confidence, and momentum. Cueframe gives every presenter a private layer of support, so every important idea has the chance to land. Thank you.",
    cue: "Pause before the final sentence. Finish looking at the audience, not the screen.",
    duration: "0:38",
    speakerNote: "End cleanly. Do not rush into Q&A.",
    accent: "#caedff",
  },
];

const recentDecks = [
  {
    title: "Series A narrative",
    meta: "12 slides · 8 min",
    updated: "Edited 24 min ago",
    tone: "Investor pitch",
    color: "#0f1012",
  },
  {
    title: "Q3 product direction",
    meta: "18 slides · 14 min",
    updated: "Presented yesterday",
    tone: "Executive update",
    color: "#9ed9ff",
  },
  {
    title: "Designing for trust",
    meta: "24 slides · 22 min",
    updated: "Edited 4 days ago",
    tone: "Keynote",
    color: "#eaf7ff",
  },
];

const presets = ["Investor pitch", "Executive update", "Keynote", "Sales demo"];

function SlideArtwork({ index, compact = false }: { index: number; compact?: boolean }) {
  const slide = index % initialSlides.length;

  if (slide === 0) {
    return (
      <div className={`slide-art slide-art--opening ${compact ? "is-compact" : ""}`}>
        <span className="slide-kicker">CUEFRAME / 2026</span>
        <h3>Reimagining the way teams meet.</h3>
        <div className="opening-orbit">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (slide === 1) {
    return (
      <div className={`slide-art slide-art--metrics ${compact ? "is-compact" : ""}`}>
        <span className="slide-kicker dark">THE PROBLEM</span>
        <h3>Attention is more fragmented than ever.</h3>
        <div className="metric-row">
          <div><strong>6.2</strong><span>tools per meeting</span></div>
          <div><strong>31%</strong><span>time lost preparing</span></div>
          <div><strong>2×</strong><span>more context switching</span></div>
        </div>
      </div>
    );
  }

  if (slide === 2) {
    return (
      <div className={`slide-art slide-art--system ${compact ? "is-compact" : ""}`}>
        <div className="system-copy">
          <span className="slide-kicker">THE SOLUTION</span>
          <h3>One focused workspace.</h3>
          <p>From deck to delivery, without breaking your flow.</p>
        </div>
        <div className="system-stack">
          <div><span>01</span>Understand</div>
          <div><span>02</span>Shape</div>
          <div><span>03</span>Deliver</div>
        </div>
      </div>
    );
  }

  if (slide === 3) {
    return (
      <div className={`slide-art slide-art--market ${compact ? "is-compact" : ""}`}>
        <span className="slide-kicker dark">THE OPPORTUNITY</span>
        <h3>A daily ritual, ready to be reimagined.</h3>
        <div className="market-bubbles">
          <span className="bubble one">Sales</span>
          <span className="bubble two">Leaders</span>
          <span className="bubble three">Founders</span>
          <span className="bubble four">Educators</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`slide-art slide-art--closing ${compact ? "is-compact" : ""}`}>
      <span className="slide-kicker">CUEFRAME</span>
      <h3>Let every idea land.</h3>
      <p>cueframe.app</p>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

export function CueframeApp() {
  const [view, setView] = useState<View>("dashboard");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState(initialSlides);
  const [deckTitle, setDeckTitle] = useState("Series A narrative");
  const [preset, setPreset] = useState("Investor pitch");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(30);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState("");
  const [showCoach, setShowCoach] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [editSaved, setEditSaved] = useState(true);
  const [refineMenu, setRefineMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prompterWindowRef = useRef<Window | null>(null);

  const activeSlide = slides[currentSlide];

  useEffect(() => {
    const stored = window.localStorage.getItem("cueframe-deck");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { title: string; slides: Slide[] };
      if (parsed.slides?.length) {
        setDeckTitle(parsed.title);
        setSlides(parsed.slides);
      }
    } catch {
      window.localStorage.removeItem("cueframe-deck");
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || view !== "present") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, view]);

  useEffect(() => {
    if (view !== "present") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((value) => !value);
      }
      if (event.key === "ArrowRight") {
        setCurrentSlide((value) => Math.min(slides.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setCurrentSlide((value) => Math.max(0, value - 1));
      }
      if (event.key === "Escape") {
        setIsPlaying(false);
        setView("studio");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, slides.length]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const persistDeck = useCallback(
    (nextSlides: Slide[]) => {
      window.localStorage.setItem(
        "cueframe-deck",
        JSON.stringify({ title: deckTitle, slides: nextSlides }),
      );
      setEditSaved(true);
    },
    [deckTitle],
  );

  const handleFile = (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    const cleanName = file.name.replace(/\.(pdf|pptx?|key|png|jpe?g)$/i, "");
    window.setTimeout(() => {
      setDeckTitle(cleanName || "Untitled presentation");
      setSlides(initialSlides);
      setCurrentSlide(0);
      setIsImporting(false);
      setView("studio");
      showToast(`${file.name} imported successfully`);
    }, 1100);
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const updateScript = (body: string) => {
    const nextSlides = slides.map((slide, index) =>
      index === currentSlide ? { ...slide, body } : slide,
    );
    setSlides(nextSlides);
    setEditSaved(false);
    window.clearTimeout(window.__cueframeSaveTimer);
    window.__cueframeSaveTimer = window.setTimeout(() => persistDeck(nextSlides), 650);
  };

  const generateScript = () => {
    setIsGenerating(true);
    setRefineMenu(false);
    window.setTimeout(() => {
      setSlides((existing) =>
        existing.map((slide, index) => ({
          ...slide,
          body:
            index === 0
              ? `Good morning. Before we begin, think about the last presentation that truly changed your mind. It probably felt clear, human, and effortless. ${slide.body.split(". ").slice(1).join(". ")}`
              : slide.body,
        })),
      );
      setIsGenerating(false);
      showToast("Your script has been refreshed");
    }, 1500);
  };

  const refineScript = (mode: string) => {
    const transforms: Record<string, (text: string) => string> = {
      Shorter: (text) => text.split(". ").slice(0, 2).join(". ") + ".",
      "More conversational": (text) =>
        `Here’s the thing: ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
      "Add energy": (text) => `${text} This is the moment where the opportunity becomes real.`,
      "Stronger transition": (text) =>
        `${text} And that brings us directly to what changes next.`,
    };
    const nextText = transforms[mode]?.(activeSlide.body) ?? activeSlide.body;
    updateScript(nextText);
    setRefineMenu(false);
    showToast(`${mode} version applied`);
  };

  const openDemo = () => {
    setDeckTitle("Series A narrative");
    setSlides(initialSlides);
    setCurrentSlide(0);
    setView("studio");
  };

  const startPresenting = () => {
    setElapsed(0);
    setIsPlaying(false);
    setView("present");
  };

  const openPrivateWindow = () => {
    const popup = window.open(
      "",
      "cueframe-private-prompter",
      "popup=yes,width=560,height=720,resizable=yes",
    );
    if (!popup) {
      showToast("Allow pop-ups to open the private presenter window");
      return;
    }
    prompterWindowRef.current = popup;
    popup.document.write(`<!doctype html>
      <html><head><title>Cueframe · Private presenter</title>
      <style>
        *{box-sizing:border-box}body{margin:0;background:#090a0c;color:#f7f8fa;font-family:Arial,sans-serif;padding:34px}
        .top{display:flex;justify-content:space-between;align-items:center;color:#8d949d;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
        .badge{color:#9ed9ff;background:#102330;padding:8px 11px;border-radius:999px}
        h1{font-size:17px;color:#9aa1a9;margin:80px 0 18px;font-weight:500}
        p{font-size:31px;line-height:1.46;letter-spacing:-.025em;margin:0;max-width:900px}
        .cue{margin-top:34px;padding:18px;border-left:2px solid #9ed9ff;background:#11151a;color:#b9c1c9;line-height:1.55}
        .footer{position:fixed;bottom:0;left:0;right:0;padding:18px 34px;background:#0e1013;border-top:1px solid #24272c;color:#8d949d;display:flex;justify-content:space-between}
      </style></head>
      <body>
        <div class="top"><span>Cueframe · private</span><span class="badge">Not audience-facing</span></div>
        <h1>${activeSlide.eyebrow} · Slide ${currentSlide + 1} of ${slides.length}</h1>
        <p>${activeSlide.body}</p>
        <div class="cue">${activeSlide.cue}</div>
        <div class="footer"><span>${deckTitle}</span><span>${activeSlide.duration}</span></div>
      </body></html>`);
    popup.document.close();
    showToast("Private presenter window opened");
  };

  if (view === "present") {
    return (
      <main className="presenter-shell">
        <header className="presenter-topbar">
          <div className="presenter-brand">
            <BrandMark />
            <span>Cueframe</span>
            <span className="private-pill"><ShieldCheck size={13} /> Private view</span>
          </div>
          <div className="presenter-timer">
            <span className={isPlaying ? "timer-dot is-live" : "timer-dot"} />
            {Math.floor(elapsed / 60).toString().padStart(2, "0")}:
            {(elapsed % 60).toString().padStart(2, "0")}
            <span>/ 08:00</span>
          </div>
          <button className="presenter-exit" onClick={() => setView("studio")}>
            <X size={17} /> Exit
          </button>
        </header>

        <section className="presenter-stage">
          <div className="presenter-context">
            <div className="presenter-slide-preview">
              <SlideArtwork index={currentSlide} compact />
            </div>
            <div className="next-preview">
              <span>Up next</span>
              <strong>{slides[Math.min(slides.length - 1, currentSlide + 1)].title}</strong>
            </div>
          </div>

          <div className="teleprompter-panel">
            <div className="teleprompter-meta">
              <span>{activeSlide.eyebrow}</span>
              <span>Slide {currentSlide + 1} of {slides.length}</span>
            </div>
            <div className="teleprompter-mask">
              <div
                className={`teleprompter-copy ${isPlaying ? "is-scrolling" : ""}`}
                style={{
                  fontSize: `${fontSize}px`,
                  animationDuration: `${Math.max(18, 56 / speed)}s`,
                }}
              >
                {activeSlide.body}
              </div>
            </div>
            {showCoach && (
              <div className="live-cue">
                <Lightbulb size={16} />
                <span>{activeSlide.cue}</span>
              </div>
            )}
          </div>
        </section>

        <footer className="presenter-controls">
          <div className="control-group">
            <button
              aria-label="Previous slide"
              onClick={() => setCurrentSlide((value) => Math.max(0, value - 1))}
              disabled={currentSlide === 0}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="play-control"
              aria-label={isPlaying ? "Pause teleprompter" : "Play teleprompter"}
              onClick={() => setIsPlaying((value) => !value)}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button
              aria-label="Next slide"
              onClick={() =>
                setCurrentSlide((value) => Math.min(slides.length - 1, value + 1))
              }
              disabled={currentSlide === slides.length - 1}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div className="control-settings">
            <label>
              <Gauge size={15} />
              Speed
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <span>{speed.toFixed(1)}×</span>
            </label>
            <label>
              Aa
              <input
                type="range"
                min="24"
                max="44"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>
            <button
              className={showCoach ? "is-active" : ""}
              onClick={() => setShowCoach((value) => !value)}
            >
              <Lightbulb size={16} /> Coach
            </button>
            <button onClick={() => setElapsed(0)}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>
          <div className="keyboard-hint"><Keyboard size={15} /> Space to pause · ← → slides</div>
        </footer>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={mobileNav ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-top">
          <button className="logo-button" onClick={() => setView("dashboard")}>
            <BrandMark />
            <span>Cueframe</span>
          </button>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>

        <button className="new-deck-button" onClick={() => fileInputRef.current?.click()}>
          <Plus size={17} />
          New presentation
          <span>⌘ N</span>
        </button>

        <nav className="main-nav" aria-label="Primary navigation">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <LayoutGrid size={17} />
            Home
          </button>
          <button onClick={openDemo}>
            <FileText size={17} />
            My presentations
            <span className="nav-count">6</span>
          </button>
          <button onClick={() => showToast("Rehearsal history is ready")}>
            <Clock3 size={17} />
            Rehearsals
          </button>
        </nav>

        <div className="sidebar-section">
          <p>Recent</p>
          {recentDecks.slice(0, 3).map((deck, index) => (
            <button key={deck.title} onClick={() => {
              setDeckTitle(deck.title);
              setCurrentSlide(index % slides.length);
              setView("studio");
            }}>
              <span className="deck-dot" style={{ background: deck.color }} />
              <span>{deck.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={() => showToast("Settings opened")}>
            <Settings2 size={17} />
            Settings
          </button>
          <div className="account-card">
            <div className="avatar">GD</div>
            <div>
              <strong>Girwan</strong>
              <span>Pro workspace</span>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.key,image/*"
        hidden
        onChange={handleInput}
      />

      <main className="main-canvas">
        {view === "dashboard" ? (
          <>
            <header className="topbar dashboard-topbar">
              <button className="mobile-menu" onClick={() => setMobileNav(true)}>
                <PanelLeftClose size={19} />
              </button>
              <div className="topbar-search">
                <Search size={17} />
                <span>Search presentations</span>
                <kbd>⌘ K</kbd>
              </div>
              <div className="topbar-actions">
                <button aria-label="Notifications"><Bell size={18} /></button>
                <button className="help-button">?</button>
              </div>
            </header>

            <div className="dashboard-content">
              <section
                className="hero-card"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="hero-copy">
                  <div className="eyebrow-pill"><Sparkles size={14} /> AI presentation coach</div>
                  <h1>Walk in prepared.<br />Sound like <em>yourself.</em></h1>
                  <p>
                    Turn any deck into a clear, natural script—with timing,
                    delivery cues, and a private presenter view.
                  </p>
                  <div className="hero-actions">
                    <button className="primary-button" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud size={17} />
                      Import your deck
                    </button>
                    <button className="text-button" onClick={openDemo}>
                      Explore a sample
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <span className="file-support">PDF, PowerPoint, Keynote, or images · up to 50 MB</span>
                </div>
                <div className="hero-visual" aria-hidden="true">
                  <div className="floating-script">
                    <div className="floating-script-top">
                      <span><Mic2 size={14} /> Live cue</span>
                      <span>01:24</span>
                    </div>
                    <p>
                      “The best presentations don’t feel performed. They feel
                      like a thought arriving at exactly the right moment.”
                    </p>
                    <div className="cue-line"><Lightbulb size={14} /> Pause. Look up.</div>
                  </div>
                  <div className="floating-slide">
                    <SlideArtwork index={0} compact />
                  </div>
                  <div className="hero-glow" />
                </div>
                {isImporting && (
                  <div className="import-overlay">
                    <div className="import-spinner" />
                    <strong>Reading your presentation</strong>
                    <span>Understanding slides, structure, and visual context…</span>
                  </div>
                )}
              </section>

              <section className="recent-section">
                <div className="section-heading">
                  <div>
                    <h2>Continue where you left off</h2>
                    <p>Your recent presentations and rehearsals.</p>
                  </div>
                  <button>View all <ChevronRight size={15} /></button>
                </div>
                <div className="deck-grid">
                  {recentDecks.map((deck, index) => (
                    <button className="deck-card" key={deck.title} onClick={() => {
                      setDeckTitle(deck.title);
                      setCurrentSlide(index % slides.length);
                      setView("studio");
                    }}>
                      <div className={`deck-thumbnail deck-thumbnail--${index + 1}`}>
                        <span className="deck-tone">{deck.tone}</span>
                        {index === 0 && <><strong>Make every<br />idea land.</strong><i /></>}
                        {index === 1 && <><span className="quarter">Q3 / 2026</span><strong>Product<br />direction</strong><i /></>}
                        {index === 2 && <><strong>Designing<br />for trust</strong><div className="trust-rings"><i /><i /><i /></div></>}
                      </div>
                      <div className="deck-info">
                        <div>
                          <strong>{deck.title}</strong>
                          <span>{deck.meta}</span>
                        </div>
                        <MoreHorizontal size={18} />
                      </div>
                      <span className="deck-updated">{deck.updated}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="workflow-strip">
                <div className="workflow-copy">
                  <span className="mini-label">YOUR PRIVATE ADVANTAGE</span>
                  <h2>From first draft to confident delivery.</h2>
                </div>
                <div className="workflow-steps">
                  <div><span>01</span><UploadCloud size={18} /><strong>Import</strong><p>Bring the deck you already have.</p></div>
                  <div><span>02</span><WandSparkles size={18} /><strong>Shape</strong><p>Build a script in your own voice.</p></div>
                  <div><span>03</span><Mic2 size={18} /><strong>Rehearse</strong><p>Find your pace and polish delivery.</p></div>
                  <div><span>04</span><Presentation size={18} /><strong>Present</strong><p>Stay supported, privately.</p></div>
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <header className="topbar studio-topbar">
              <div className="studio-title">
                <button onClick={() => setView("dashboard")}><ArrowLeft size={18} /></button>
                <div>
                  <strong>{deckTitle}</strong>
                  <span>{editSaved ? <><Check size={12} /> Saved</> : "Saving…"}</span>
                </div>
              </div>
              <div className="studio-status">
                <span className="privacy-status"><ShieldCheck size={14} /> Private by default</span>
                <button className="secondary-button" onClick={openPrivateWindow}>
                  <Monitor size={16} /> Open private window
                </button>
                <button className="primary-button compact" onClick={startPresenting}>
                  <Play size={15} fill="currentColor" /> Present
                </button>
              </div>
            </header>

            <div className="studio-layout">
              <section className="slide-column">
                <div className="studio-section-label">
                  <span>Slide preview</span>
                  <div>
                    <button aria-label="Fit slide"><Maximize2 size={15} /></button>
                    <button aria-label="More slide options"><MoreHorizontal size={16} /></button>
                  </div>
                </div>
                <div className="active-slide">
                  <SlideArtwork index={currentSlide} />
                </div>
                <div className="slide-strip">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.title}
                      className={index === currentSlide ? "active" : ""}
                      onClick={() => setCurrentSlide(index)}
                    >
                      <span>{index + 1}</span>
                      <div><SlideArtwork index={index} compact /></div>
                    </button>
                  ))}
                  <button className="add-slide"><Plus size={17} /></button>
                </div>
              </section>

              <section className="script-column">
                <div className="script-toolbar">
                  <div>
                    <span className="studio-section-label">Speaker script</span>
                    <span className="word-count">{activeSlide.body.split(/\s+/).length} words · {activeSlide.duration}</span>
                  </div>
                  <div className="preset-select">
                    <span>{preset}</span>
                    <ChevronDown size={14} />
                    <select
                      aria-label="Presentation preset"
                      value={preset}
                      onChange={(event) => setPreset(event.target.value)}
                    >
                      {presets.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                </div>

                <div className="script-editor-wrap">
                  <div className="script-index">{String(currentSlide + 1).padStart(2, "0")}</div>
                  <textarea
                    aria-label={`Speaker script for slide ${currentSlide + 1}`}
                    value={activeSlide.body}
                    onChange={(event) => updateScript(event.target.value)}
                  />
                  <div className="editor-actions">
                    <div className="refine-wrap">
                      <button className="ai-refine" onClick={() => setRefineMenu((value) => !value)}>
                        <Sparkles size={15} />
                        Refine with AI
                        <ChevronDown size={13} />
                      </button>
                      {refineMenu && (
                        <div className="refine-menu">
                          {["Shorter", "More conversational", "Add energy", "Stronger transition"].map((mode) => (
                            <button key={mode} onClick={() => refineScript(mode)}>{mode}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button aria-label="Undo"><RotateCcw size={15} /></button>
                  </div>
                </div>

                <div className="coach-card">
                  <div className="coach-icon"><Lightbulb size={17} /></div>
                  <div>
                    <span>Delivery cue</span>
                    <p>{activeSlide.cue}</p>
                  </div>
                  <button aria-label="Edit delivery cue"><MoreHorizontal size={17} /></button>
                </div>

                <div className="notes-row">
                  <div><MessageSquareText size={16} /><span>Speaker note</span></div>
                  <p>{activeSlide.speakerNote}</p>
                </div>

                <div className="script-footer">
                  <button className="generate-button" onClick={generateScript} disabled={isGenerating}>
                    {isGenerating ? <span className="button-spinner" /> : <WandSparkles size={16} />}
                    {isGenerating ? "Shaping your script…" : "Regenerate full script"}
                  </button>
                  <button className="rehearse-button" onClick={startPresenting}>
                    <TimerReset size={16} />
                    Rehearse from here
                  </button>
                </div>
              </section>
            </div>

            <div className="studio-bottom-bar">
              <div className="timeline-progress">
                <span style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }} />
              </div>
              <div>
                <span>{currentSlide + 1} / {slides.length} slides</span>
                <span>Estimated total · 4:08</span>
              </div>
              <button onClick={() => setCurrentSlide((value) => Math.max(0, value - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentSlide((value) => Math.min(slides.length - 1, value + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </main>

      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      {toast && <div className="toast"><CircleCheck size={17} /> {toast}</div>}
    </div>
  );
}

declare global {
  interface Window {
    __cueframeSaveTimer: number;
  }
}
