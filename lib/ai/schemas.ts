import { z } from "zod";
import { CUE_TYPES } from "../domain/cues";

/**
 * Contracts between the browser orchestrator and the AI gateway routes.
 * `*Request` schemas validate untrusted input on the server. `*Output` schemas are what the model
 * must return (strict structured output: every field required, no length constraints — those are
 * enforced after parsing so the model is never asked for something the schema dialect can't express).
 */

const text = (max: number) => z.string().trim().max(max);

// ── Shared pieces ───────────────────────────────────────────────────────────

export const BriefInput = z.object({
  goal: text(600),
  audience: text(400),
  keyMessage: text(600),
  mustInclude: text(1500),
  avoid: text(800),
  presenterRole: text(300),
  minutes: z.number().min(1).max(120),
  qaMinutes: z.number().min(0).max(60),
  wpm: z.number().min(80).max(220),
  style: z.enum(["conversational", "measured", "concise", "energetic", "technical", "executive"]),
  depth: z.enum(["full", "notes", "cues"]),
  cueDensity: z.enum(["none", "light", "detailed"]),
  includeQuestions: z.boolean(),
});
export type BriefInput = z.infer<typeof BriefInput>;

export const ContextInput = z.object({
  title: text(200),
  topic: text(300),
  summary: text(1200),
}).nullable();

export const AnalysisInput = z.object({
  mainPoint: text(600),
  visualSummary: text(1200),
  elements: z.array(z.object({ label: text(200), region: text(80) })).max(12),
  kind: text(20),
  complexity: z.number().min(1).max(5),
  uncertain: z.array(text(300)).max(6),
}).nullable();


// ── Analyze ─────────────────────────────────────────────────────────────────

export const AnalyzeRequest = z.object({
  fileName: text(260),
  slideCount: z.number().int().min(1).max(200),
  slides: z.array(z.object({
    id: text(40).min(1),
    index: z.number().int().min(1).max(200),
    title: text(300),
    text: text(6000),
    notes: text(4000),
    image: z.string().max(4_000_000).regex(/^data:image\/(png|jpeg|webp);base64,/).nullable(),
  })).min(1).max(6),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;

export const SlideAnalysisOutput = z.object({
  id: z.string(),
  title: z.string(),
  mainPoint: z.string(),
  visualSummary: z.string(),
  elements: z.array(z.object({ label: z.string(), region: z.string() })),
  complexity: z.number(),
  kind: z.enum(["title", "section", "content", "chart", "diagram", "image", "table", "closing"]),
  uncertain: z.array(z.string()),
});
export const AnalyzeOutput = z.object({ slides: z.array(SlideAnalysisOutput) });
export type AnalyzeOutput = z.infer<typeof AnalyzeOutput>;

// ── Deck context ────────────────────────────────────────────────────────────

export const ContextRequest = z.object({
  fileName: text(260),
  slides: z.array(z.object({ index: z.number().int(), title: text(300), mainPoint: text(600), kind: text(20) })).min(1).max(200),
});
export type ContextRequest = z.infer<typeof ContextRequest>;

export const ContextOutput = z.object({
  title: z.string(),
  topic: z.string(),
  summary: z.string(),
  suggestedGoal: z.string(),
  suggestedAudience: z.string(),
  suggestedKeyMessage: z.string(),
});
export type ContextOutput = z.infer<typeof ContextOutput>;

// ── Outline ─────────────────────────────────────────────────────────────────

export const OutlineRequest = z.object({
  brief: BriefInput,
  context: ContextInput,
  title: text(200),
  slides: z.array(z.object({
    id: text(40).min(1),
    index: z.number().int(),
    title: text(300),
    mainPoint: text(600),
    kind: text(20),
    targetWords: z.number().int().min(0).max(5000),
    optional: z.boolean(),
  })).min(1).max(200),
});
export type OutlineRequest = z.infer<typeof OutlineRequest>;

export const OutlineOutput = z.object({
  arc: z.string(),
  voice: z.string(),
  slides: z.array(z.object({ id: z.string(), role: z.string(), keyIdea: z.string(), transition: z.string() })),
});
export type OutlineOutput = z.infer<typeof OutlineOutput>;

// ── Write ───────────────────────────────────────────────────────────────────

export const WriteSlideInput = z.object({
  id: text(40).min(1),
  index: z.number().int(),
  title: text(300),
  text: text(6000),
  notes: text(4000),
  analysis: AnalysisInput,
  role: text(400),
  keyIdea: text(600),
  transition: text(600),
  /** The previous slide's planned closing line, so this slide can pick up where it left off. */
  previousTransition: text(600).default(""),
  targetWords: z.number().int().min(0).max(5000),
  previousTitle: text(300),
  nextTitle: text(300),
});
export type WriteSlideInput = z.infer<typeof WriteSlideInput>;

export const WriteRequest = z.object({
  brief: BriefInput,
  context: ContextInput,
  title: text(200),
  arc: text(2000),
  /** How every slide should sound, set once by the outline so batches written in parallel match. */
  voice: text(1200).default(""),
  totalSlides: z.number().int().min(1).max(200),
  slides: z.array(WriteSlideInput).min(1).max(6),
});
export type WriteRequest = z.infer<typeof WriteRequest>;

export const CueOutput = z.object({
  paragraph: z.number(),
  afterSentence: z.number(),
  type: z.enum(CUE_TYPES),
  text: z.string(),
});

export const MarkOutput = z.object({
  paragraph: z.number(),
  sentence: z.number(),
  text: z.string(),
  mark: z.enum(["bold", "slow"]),
});

export const WrittenSlideOutput = z.object({
  id: z.string(),
  purpose: z.string(),
  paragraphs: z.array(z.string()),
  cues: z.array(CueOutput),
  marks: z.array(MarkOutput),
  concise: z.string(),
  keywords: z.array(z.string()),
  recovery: z.string(),
  transition: z.string(),
  questions: z.array(z.object({ question: z.string(), answer: z.string() })),
});
export type WrittenSlideOutput = z.infer<typeof WrittenSlideOutput>;
/** What the model writes. Cues and marks are placed afterwards by code (lib/domain/cues.ts), never by the model. */
export const WrittenSlideDraft = WrittenSlideOutput.omit({ cues: true, marks: true });
export type WrittenSlideDraft = z.infer<typeof WrittenSlideDraft>;
export const WriteOutput = z.object({ slides: z.array(WrittenSlideDraft) });
export type WriteOutput = z.infer<typeof WriteOutput>;

// ── Delivery ────────────────────────────────────────────────────────────────

/** Marks pauses, bold and slow across a whole written deck, once every slide's prose is final. */
export const DeliverRequest = z.object({
  density: z.enum(["none", "light", "detailed"]),
  slides: z.array(z.object({
    id: text(40).min(1),
    title: text(300),
    kind: text(20),
    keyIdea: text(600),
    first: z.boolean(),
    paragraphs: z.array(text(4000)).max(40),
  })).min(1).max(200),
});
export type DeliverRequest = z.infer<typeof DeliverRequest>;
export type DeliveredSlide = { id: string } & Pick<WrittenSlideOutput, "cues" | "marks">;

// What the delivery coach is sent (server-internal).

export type DeliverySlideInput = {
  id: string;
  title: string;
  kind: string;
  keyIdea: string;
  /** Sentence texts in reading order; `paragraphStarts` holds the 1-based numbers that open a paragraph. */
  sentences: string[];
  paragraphStarts: number[];
};
export type DeliveryRequest = { slides: DeliverySlideInput[] };

// Facts about each sentence, not placements: code turns agreed facts into cues and marks.
export const DeliveryOutput = z.object({
  slides: z.array(z.object({
    id: z.string(),
    sentences: z.array(z.object({
      n: z.number(),
      asksAudience: z.boolean(),
      statesMainPoint: z.boolean(),
      turnsArgument: z.boolean(),
      mustCatchExactly: z.boolean(),
      stress: z.string(),
    })),
  })),
});
export type DeliveryOutput = z.infer<typeof DeliveryOutput>;

// ── Rewrite ─────────────────────────────────────────────────────────────────

export const REWRITE_ACTIONS = ["fit", "conversational", "simpler", "transition", "example", "regenerate"] as const;
export const SELECTION_ACTIONS = ["shorter", "simpler", "conversational", "clearer"] as const;

const RewriteSlide = z.object({
  title: text(300),
  text: text(6000),
  notes: text(4000),
  analysis: AnalysisInput,
  previousTitle: text(300),
  nextTitle: text(300),
});

export const RewriteRequest = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("script"),
    action: z.enum(REWRITE_ACTIONS),
    brief: BriefInput,
    title: text(200),
    slide: RewriteSlide,
    paragraphs: z.array(text(4000)).max(40),
    targetWords: z.number().int().min(5).max(5000),
  }),
  z.object({
    kind: z.literal("selection"),
    action: z.enum(SELECTION_ACTIONS),
    brief: BriefInput,
    title: text(200),
    slide: RewriteSlide,
    paragraphs: z.array(text(4000)).max(40),
    selection: text(4000).min(1),
  }),
  z.object({
    kind: z.literal("support"),
    brief: BriefInput,
    title: text(200),
    slide: RewriteSlide,
    paragraphs: z.array(text(4000)).max(40),
  }),
  z.object({
    kind: z.literal("questions"),
    brief: BriefInput,
    title: text(200),
    slide: RewriteSlide,
    paragraphs: z.array(text(4000)).max(40),
  }),
]);
export type RewriteRequest = z.infer<typeof RewriteRequest>;

export const ScriptRewriteOutput = z.object({ paragraphs: z.array(z.string()) });
export const SelectionRewriteOutput = z.object({ text: z.string() });
export const SupportOutput = z.object({ concise: z.string(), keywords: z.array(z.string()), recovery: z.string(), transition: z.string() });
export const QuestionsOutput = z.object({ questions: z.array(z.object({ question: z.string(), answer: z.string() })) });

export type ScriptRewriteOutput = z.infer<typeof ScriptRewriteOutput>;
export type SelectionRewriteOutput = z.infer<typeof SelectionRewriteOutput>;
export type SupportOutput = z.infer<typeof SupportOutput>;
export type QuestionsOutput = z.infer<typeof QuestionsOutput>;

export type AiStatus = { provider: "openai" | "demo" | "none"; model: string | null };
