import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-sol";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const CuePointSchema = z.object({
  afterSentence: z.number().int().min(1).max(20),
  type: z.enum([
    "pause",
    "emphasis",
    "gesture",
    "eye-contact",
    "transition",
    "delivery",
  ]),
  instruction: z.string().min(1),
});

const ScriptSlideSchema = z.object({
  title: z.string().min(1),
  eyebrow: z.string().min(1),
  body: z.string().min(1),
  cue: z.string().min(1),
  cues: z.array(CuePointSchema).min(1).max(4),
  duration: z.string().regex(/^\d{1,2}:\d{2}$/),
  speakerNote: z.string().min(1),
});

const PresentationScriptSchema = z.object({
  deckTitle: z.string().min(1),
  summary: z.string().min(1),
  slides: z.array(ScriptSlideSchema).min(1).max(40),
});

const RefinedSlideSchema = z.object({
  body: z.string().min(1),
  cue: z.string().min(1),
  cues: z.array(CuePointSchema).min(1).max(4),
  duration: z.string().regex(/^\d{1,2}:\d{2}$/),
  speakerNote: z.string().min(1),
});

const ExistingSlideSchema = ScriptSlideSchema.omit({ cues: true }).extend({
  cues: z.array(CuePointSchema).max(4).optional(),
  accent: z.string().optional(),
});

const JsonRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    deckTitle: z.string().min(1).max(180),
    preset: z.string().min(1).max(80),
    slides: z.array(ExistingSlideSchema).min(1).max(40),
  }),
  z.object({
    action: z.literal("refine"),
    deckTitle: z.string().min(1).max(180),
    preset: z.string().min(1).max(80),
    mode: z.enum([
      "Shorter",
      "More conversational",
      "Add energy",
      "Stronger transition",
    ]),
    slide: ExistingSlideSchema,
  }),
]);

const ACCENTS = ["#9ed9ff", "#dff3ff", "#b8e5ff", "#92d5ff", "#caedff"];

const SPEECHWRITER_INSTRUCTIONS = `
You are Cueframe, an expert presentation speechwriter and delivery coach.

Goal:
Create natural spoken language that helps a presenter explain the supplied deck
clearly, confidently, and in their own voice.

Success criteria:
- produce one script entry for each meaningful slide, in original slide order
- ground every factual claim, number, name, and product capability in the supplied deck
- write for speech, using short sentences, natural contractions, and clear transitions
- include sparse, useful delivery direction: pauses, emphasis, eye contact, or gestures
- place those directions in the cues array at the exact sentence where the presenter needs them
- treat afterSentence as a one-based sentence position within the spoken body
- use one to four cue points per slide and vary cue types only when genuinely helpful
- estimate a realistic speaking duration for every slide in M:SS format
- make each slide understandable without simply reading visible slide text aloud

Constraints:
- do not invent metrics, customer names, dates, citations, or capabilities
- if a slide is ambiguous, use careful language rather than guessing
- keep stage directions out of the spoken body; summarize them in cue and place each one in cues
- use the speakerNote field for intent, risk, or optional context
- make opening and closing slides feel deliberate
- return only the requested structured output
`.trim();

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function withAccents(slides: z.infer<typeof ScriptSlideSchema>[]) {
  return slides.map((slide, index) => ({
    ...slide,
    accent: ACCENTS[index % ACCENTS.length],
  }));
}

function toDataUrl(file: File, buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function cleanDeckTitle(filename: string) {
  return filename
    .replace(/\.(pdf|pptx?|key|png|jpe?g|webp)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

async function generateFromFile(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const preset = String(form.get("preset") || "Investor pitch").slice(0, 80);
  const audience = String(form.get("audience") || "A smart general business audience").slice(0, 240);
  const targetMinutes = Number(form.get("targetMinutes") || 8);

  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a presentation file to continue." }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "The presentation must be smaller than 50 MB." }, { status: 400 });
  }

  const dataUrl = toDataUrl(file, await file.arrayBuffer());
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const sourceItem = isImage
    ? {
        type: "input_image" as const,
        image_url: dataUrl,
        detail: "high" as const,
      }
    : {
        type: "input_file" as const,
        filename: file.name,
        file_data: dataUrl,
        ...(isPdf ? { detail: "high" as const } : {}),
      };

  const prompt = `
Create a complete presentation script for the attached deck.

Presentation type: ${preset}
Audience: ${audience}
Target total duration: ${Number.isFinite(targetMinutes) ? Math.min(60, Math.max(2, targetMinutes)) : 8} minutes
Source filename: ${file.name}

Use the deck's actual slide structure. Keep cues helpful and restrained. If the
source is a PowerPoint or Keynote file, embedded charts may not be visible; do
not infer chart values that are not present in extracted text.
`.trim();

  const response = await getClient().responses.parse({
    model: MODEL,
    reasoning: { effort: "medium" },
    store: false,
    instructions: SPEECHWRITER_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          sourceItem,
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    text: {
      verbosity: "medium",
      format: zodTextFormat(PresentationScriptSchema, "presentation_script"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a presentation script.");
  }

  return Response.json({
    deckTitle: response.output_parsed.deckTitle || cleanDeckTitle(file.name),
    summary: response.output_parsed.summary,
    slides: withAccents(response.output_parsed.slides),
    model: response.model,
  });
}

async function generateFromExistingDeck(payload: Extract<z.infer<typeof JsonRequestSchema>, { action: "generate" }>) {
  const sourceSlides = payload.slides.map((slide, index) => ({
    slide: index + 1,
    title: slide.title,
    section: slide.eyebrow,
    currentScript: slide.body,
    currentCue: slide.cue,
    currentCuePoints: slide.cues ?? [],
    currentSpeakerNote: slide.speakerNote,
  }));

  const response = await getClient().responses.parse({
    model: MODEL,
    reasoning: { effort: "medium" },
    store: false,
    instructions: SPEECHWRITER_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Rewrite the complete script for "${payload.deckTitle}" as a ${payload.preset}.
Preserve slide order and all grounded facts. Improve narrative flow between slides.

Current slide material:
${JSON.stringify(sourceSlides)}`,
      },
    ],
    text: {
      verbosity: "medium",
      format: zodTextFormat(PresentationScriptSchema, "presentation_script"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a presentation script.");
  }

  return Response.json({
    deckTitle: payload.deckTitle,
    summary: response.output_parsed.summary,
    slides: response.output_parsed.slides.map((slide, index) => ({
      ...slide,
      accent: payload.slides[index]?.accent ?? ACCENTS[index % ACCENTS.length],
    })),
    model: response.model,
  });
}

async function refineSlide(payload: Extract<z.infer<typeof JsonRequestSchema>, { action: "refine" }>) {
  const modeInstructions: Record<typeof payload.mode, string> = {
    Shorter: "Reduce the spoken duration by about 30% while preserving every essential claim.",
    "More conversational": "Make the language warmer and more conversational without becoming casual or adding filler.",
    "Add energy": "Increase momentum and conviction through rhythm and stronger verbs, without hype.",
    "Stronger transition": "Preserve the substance and end with a clear transition into the next idea.",
  };

  const response = await getClient().responses.parse({
    model: MODEL,
    reasoning: { effort: "low" },
    store: false,
    instructions: SPEECHWRITER_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: `Refine one slide from "${payload.deckTitle}" (${payload.preset}).

Requested change: ${modeInstructions[payload.mode]}
Slide title: ${payload.slide.title}
Current spoken script: ${payload.slide.body}
Current delivery cue: ${payload.slide.cue}
Current inline cue points: ${JSON.stringify(payload.slide.cues ?? [])}
Current speaker note: ${payload.slide.speakerNote}

Preserve the slide's factual content and intended role in the presentation.`,
      },
    ],
    text: {
      verbosity: "medium",
      format: zodTextFormat(RefinedSlideSchema, "refined_slide"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a refined slide.");
  }

  return Response.json({
    slide: {
      ...payload.slide,
      ...response.output_parsed,
    },
    model: response.model,
  });
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        code: "missing_api_key",
        error: "Add OPENAI_API_KEY to .env.local to enable AI generation.",
      },
      { status: 503 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      return await generateFromFile(request);
    }

    const parsed = JsonRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "The AI request was incomplete or invalid." }, { status: 400 });
    }

    if (parsed.data.action === "refine") {
      return await refineSlide(parsed.data);
    }

    return await generateFromExistingDeck(parsed.data);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API error", {
        status: error.status,
        code: error.code,
        requestId: error.request_id,
      });
      return Response.json(
        {
          error:
            error.status === 401
              ? "The OpenAI API key was rejected. Check OPENAI_API_KEY in .env.local."
              : "OpenAI could not generate the script right now. Please try again.",
        },
        { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    console.error("Script generation failed", error);
    return Response.json(
      { error: "Cueframe could not process this presentation. Please try another file." },
      { status: 500 },
    );
  }
}
