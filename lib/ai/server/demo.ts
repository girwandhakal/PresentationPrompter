import type { AiProvider } from "./provider";
import type { WriteSlideInput } from "../schemas";
import { countWords } from "../validate";

/**
 * Deterministic stand-in for a real model, used in development and automated tests when no API key
 * is configured. It only rearranges text that is already on the slides, so the full flow can be
 * exercised end to end. The UI labels its output as demo content.
 */

const STOP = new Set("a an and are as at be but by for from has have in is it its of on or our so that the their this to we with you your will can not".split(" "));

function lines(text: string) {
  return text.split(/\n+/).map((line) => line.replace(/^[•\-–*\d.)\s]+/, "").trim()).filter((line) => line.length > 2);
}

function sentence(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const capitalized = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function splitSentences(text: string) {
  return (text.match(/[^.!?…]+[.!?…]*/g) ?? []).map((part) => part.trim()).filter(Boolean);
}

const BRIDGES = [
  "Let me put that in context.",
  "Here's why that matters for this group.",
  "Take a moment with what's on the slide.",
  "That's the part worth remembering.",
  "It helps to look at this from the audience's side.",
  "This is where the detail on the slide comes in.",
];

function fitSentences(sentences: string[], target: number) {
  const result: string[] = [];
  let words = 0;
  for (const value of sentences) {
    if (words >= target) break;
    result.push(value);
    words += countWords(value);
  }
  // Pad with neutral bridges once at most; an honest under-length draft beats repetition.
  for (const extra of BRIDGES) {
    if (words >= target * 0.85) break;
    result.push(extra);
    words += countWords(extra);
  }
  return result;
}

function toParagraphs(sentences: string[]) {
  const size = Math.max(2, Math.ceil(sentences.length / 3));
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += size) paragraphs.push(sentences.slice(index, index + size).join(" "));
  return paragraphs;
}

function keywords(text: string) {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (!STOP.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);
}

function slideSentences(slide: Pick<WriteSlideInput, "title" | "text" | "notes" | "index">) {
  const source = (slide.notes.trim() ? slide.notes : slide.text)
    .split(/\n+/)
    .flatMap((line) => splitSentences(line.replace(/^[•\-–*\d.)\s]+/, "")))
    .map((value) => value.trim())
    .filter((value) => countWords(value) >= 4 && !slide.title.toLowerCase().startsWith(value.toLowerCase().replace(/[.!?]$/, "")));
  const opening = slide.index === 1 ? `Thanks for being here. Today we're looking at ${slide.title}.` : `Now, ${slide.title.charAt(0).toLowerCase()}${slide.title.slice(1)}.`;
  return [opening, ...source.map(sentence)].filter(Boolean);
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 120));

export function createDemoProvider(): AiProvider {
  return {
    status: { provider: "demo", model: null },

    async analyze(request) {
      await delay();
      return {
        slides: request.slides.map((slide) => {
          const body = lines(slide.text);
          const title = slide.title || body[0]?.slice(0, 90) || `Slide ${slide.index}`;
          const words = countWords(slide.text);
          const kind = slide.index === 1 ? "title" as const : slide.index === request.slideCount ? "closing" as const : words ? "content" as const : "image" as const;
          return {
            id: slide.id,
            title,
            mainPoint: sentence(body.find((line) => line !== title && line.length > 20) ?? title),
            visualSummary: words ? `A text slide with ${Math.max(1, body.length - 1)} point${body.length === 2 ? "" : "s"}.` : "An image-only slide.",
            elements: body.slice(1, 4).map((line, index) => ({ label: line.slice(0, 60), region: ["upper left", "middle", "lower left"][index] })),
            complexity: words < 12 ? 2 : words < 45 ? 3 : words < 90 ? 4 : 5,
            kind,
            uncertain: words ? [] : ["Demo mode can't read images; add a note describing this slide."],
          };
        }),
      };
    },

    async context(request) {
      await delay();
      const first = request.slides[0];
      const topic = first?.title || request.fileName;
      return {
        title: first?.title || request.fileName,
        topic,
        summary: `A ${request.slides.length}-slide presentation about ${topic}.`,
        suggestedGoal: `Help the audience understand ${topic.toLowerCase()} and what comes next.`,
        suggestedAudience: "Colleagues who know the context but not the details",
        suggestedKeyMessage: request.slides[1]?.mainPoint || first?.mainPoint || "",
      };
    },

    async outline(request) {
      await delay();
      const included = request.slides;
      return {
        arc: `Open with ${included[0]?.title}, build through the main points, and close on ${included.at(-1)?.title}.`,
        voice: `Plain and conversational, speaking as "we" to ${request.brief.audience || "colleagues"}.`,
        slides: included.map((slide, index) => ({
          id: slide.id,
          role: index === 0 ? "Opens the talk" : index === included.length - 1 ? "Closes the talk" : "Develops the argument",
          keyIdea: slide.mainPoint || slide.title,
          transition: index === included.length - 1 ? (request.brief.qaMinutes ? "I'd be glad to take your questions." : "Thank you.") : `That leads us to ${included[index + 1].title.replace(/[.!?…]+$/, "")}.`,
        })),
      };
    },

    async write(request) {
      await delay();
      return {
        slides: request.slides.map((slide) => {
          const sentences = fitSentences(slideSentences(slide), slide.targetWords);
          const paragraphs = request.brief.depth === "full"
            ? toParagraphs(sentences)
            : request.brief.depth === "notes"
              ? sentences.map((value) => value.replace(/\.$/, "")).slice(0, 5)
              : keywords(`${slide.title} ${slide.text}`).slice(0, 5);
          return {
            id: slide.id,
            purpose: slide.role || `Covers ${slide.title}.`,
            paragraphs: paragraphs.length ? paragraphs : [sentence(slide.title)],
            concise: sentences.slice(0, 2).join(" "),
            keywords: keywords(`${slide.title} ${slide.text} ${slide.notes}`),
            recovery: `The point here is simple: ${slide.keyIdea || slide.title}`,
            transition: slide.transition || (slide.nextTitle ? `Next, ${slide.nextTitle.replace(/[.!?…]+$/, "")}.` : "Thank you."),
            questions: request.brief.includeQuestions ? [{ question: `What does ${slide.title.toLowerCase()} mean for us?`, answer: "I'd want to confirm the specifics before answering precisely — let's follow up after." }] : [],
          };
        }),
      };
    },

    async rewriteScript(request) {
      await delay();
      let sentences = request.paragraphs.flatMap(splitSentences);
      if (!sentences.length) sentences = slideSentences({ ...request.slide, index: 2 });
      if (request.action === "conversational") sentences = sentences.map((value, index) => (index === 0 ? `So, ${value.charAt(0).toLowerCase()}${value.slice(1)}` : value).replace(/\bdo not\b/gi, "don't").replace(/\bit is\b/gi, "it's").replace(/\bwe are\b/gi, "we're"));
      if (request.action === "simpler") sentences = sentences.flatMap((value) => value.split(/,\s+/).map(sentence));
      if (request.action === "transition") {
        if (request.slide.previousTitle) sentences.unshift(`Building on ${request.slide.previousTitle.toLowerCase()}, let's continue.`);
        if (request.slide.nextTitle) sentences.push(`That brings us to ${request.slide.nextTitle.toLowerCase()}.`);
      }
      if (request.action === "example") sentences.push("For example, imagine a team putting this into practice next week.");
      if (request.action === "regenerate") sentences = [...sentences].reverse();
      const fitted = fitSentences(sentences, request.targetWords);
      const trimmed: string[] = [];
      let words = 0;
      for (const value of fitted) {
        if (words + countWords(value) > request.targetWords * 1.1 && trimmed.length) break;
        trimmed.push(value);
        words += countWords(value);
      }
      const paragraphs = toParagraphs(trimmed);
      return { paragraphs };
    },

    async rewriteSelection(request) {
      await delay();
      const words = request.selection.trim().split(/\s+/);
      if (request.action === "shorter") return { text: words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ").replace(/[,;:]$/, "") };
      if (request.action === "simpler") return { text: request.selection.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim() };
      if (request.action === "conversational") return { text: `So, ${request.selection.trim().charAt(0).toLowerCase()}${request.selection.trim().slice(1)}` };
      return { text: request.selection.trim() };
    },

    async support(request) {
      await delay();
      const all = request.paragraphs.join(" ");
      const sentences = splitSentences(all);
      return {
        concise: sentences.slice(0, 2).join(" ") || request.slide.title,
        keywords: keywords(`${request.slide.title} ${all}`),
        recovery: `The point here is simple: ${sentences[0] ?? request.slide.title}`,
        transition: request.slide.nextTitle ? `That leads us to ${request.slide.nextTitle.toLowerCase()}.` : "Thank you.",
      };
    },

    // Plain-text answers to the coach's questions, so demo runs exercise the same vote-then-place path.
    async delivery(request) {
      await delay();
      return {
        slides: request.slides.map((slide) => {
          const key = new Set(keywords(slide.keyIdea));
          const shared = slide.sentences.map((text) => keywords(text).filter((word) => key.has(word)).length);
          const main = shared.indexOf(Math.max(2, ...shared));
          return {
            id: slide.id,
            sentences: slide.sentences.map((text, index) => ({
              n: index + 1,
              asksAudience: text.trim().endsWith("?"),
              statesMainPoint: index === main,
              turnsArgument: /^(?:but|however|yet|instead|that said|the catch|the problem)\b/i.test(text.trim()),
              mustCatchExactly: (text.match(/(?<!\w)\d[\d,.]*%?/g) ?? []).length >= 2,
              stress: text.match(/(?<!\w)\d[\d,]*%?/)?.[0] ?? "",
            })),
          };
        }),
      };
    },

    async questions(request) {
      await delay();
      return {
        questions: [
          { question: `How confident are we about ${request.slide.title.toLowerCase()}?`, answer: "I'd want to confirm the details before giving a firm answer." },
          { question: "What would you need from us?", answer: "Your feedback on the plan, and a decision on next steps." },
        ],
      };
    },
  };
}
