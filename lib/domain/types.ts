import type { ScriptDocument } from "./script";

export type SourceKind = "pdf" | "images" | "pptx";

export type SlideWarning = {
  kind: "sparse-text" | "animation" | "media" | "approximate-render" | "large-image";
  message: string;
};

/** What the vision/text analysis pass learned about one slide. */
export type SlideAnalysis = {
  title: string;
  mainPoint: string;
  visualSummary: string;
  elements: { label: string; region: string }[];
  complexity: number; // 1 (title/transition) … 5 (dense chart or diagram)
  kind: "title" | "section" | "content" | "chart" | "diagram" | "image" | "table" | "closing";
  uncertain: string[];
};

export type QuestionPrep = { id: string; question: string; answer: string };

/** Everything the presenter says or sees privately for a slide. Never sent to the audience. */
export type SlideScript = {
  document: ScriptDocument;
  purpose: string;
  concise: string;
  keywords: string[];
  transition: string;
  recovery: string;
  questions: QuestionPrep[];
  origin: "ai" | "user" | "mixed" | "empty";
};

export type Slide = {
  id: string;
  /** Position in the originally imported file (1-based). */
  sourceIndex: number;
  title: string;
  text: string;
  notes: string;
  imageKey: string;
  thumbKey: string;
  width: number;
  height: number;
  warnings: SlideWarning[];
  optional: boolean;
  /** Seconds the presenter wants to spend here; null means "use the planner". */
  targetSeconds: number | null;
  analysis: SlideAnalysis | null;
  script: SlideScript;
};

export type DeliveryStyle = "conversational" | "measured" | "concise" | "energetic" | "technical" | "executive";
export type ScriptDepth = "full" | "notes" | "cues";
export type CueDensity = "none" | "light" | "detailed";

export type Brief = {
  goal: string;
  audience: string;
  keyMessage: string;
  mustInclude: string;
  avoid: string;
  presenterRole: string;
  minutes: number;
  qaMinutes: number;
  wpm: number;
  style: DeliveryStyle;
  depth: ScriptDepth;
  cueDensity: CueDensity;
  includeQuestions: boolean;
};

export type DeckContext = {
  title: string;
  topic: string;
  summary: string;
  suggestedGoal: string;
  suggestedAudience: string;
  suggestedKeyMessage: string;
};

export type GenerationState =
  | { status: "idle" }
  | { status: "running"; phase: "analyzing" | "writing"; startedAt: number }
  | { status: "failed"; error: string; at: number };

export type ProjectStatus = "setup" | "ready";

export type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectStatus;
  source: { fileName: string; kind: SourceKind; bytes: number };
  aspectRatio: number;
  slides: Slide[];
  brief: Brief;
  context: DeckContext | null;
  analysis: { status: "idle" | "running" | "done" | "failed"; error?: string };
  generation: GenerationState;
  /** The brief values the current script was generated against, for rebalance detection. */
  generatedWith: Pick<Brief, "minutes" | "qaMinutes" | "wpm" | "depth"> | null;
  lastPresentedAt: number | null;
};

export type ScriptVersion = {
  id: string;
  projectId: string;
  createdAt: number;
  label: string;
  slides: { slideId: string; script: SlideScript }[];
};

export type SessionSlideRecord = {
  slideId: string;
  seconds: number;
  visits: number;
  targetSeconds: number;
};

export type PresenterSession = {
  id: string;
  projectId: string;
  startedAt: number;
  endedAt: number | null;
  totalSeconds: number;
  targetSeconds: number;
  completed: boolean;
  slides: SessionSlideRecord[];
  skipped: string[];
};
