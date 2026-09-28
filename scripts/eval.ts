/**
 * Script-generation eval: runs fixture decks through the real AI routes, the same pipeline the app
 * runs (analyze → context → plan → outline → write), and scores what comes back.
 *
 * Paid calls require explicit --live=true, --deck=<name> and --budget=<token-cap>.
 *
 * Needs OPENAI_API_KEY in .env.local. Full scripts are written to outputs/ for reading; the console
 * shows the scores. Rerun after any prompt or model change and compare.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { POST as analyzeRoute } from "../app/api/ai/analyze/route";
import { POST as contextRoute } from "../app/api/ai/context/route";
import { POST as outlineRoute } from "../app/api/ai/outline/route";
import { POST as writeRoute } from "../app/api/ai/write/route";
import type { BriefInput, WriteRequest, WrittenSlideOutput } from "../lib/ai/schemas";
import { slideSource, spokenProblems, ungroundedFigures } from "../lib/ai/server/spoken-lint";
import { paragraphsWords } from "../lib/ai/validate";
import { DEFAULT_BRIEF, planPresentation } from "../lib/domain/planner";
import { splitSentences } from "../lib/domain/script";
import type { Brief, SlideAnalysis } from "../lib/domain/types";

type Fixture = { name: string; brief: Partial<Brief>; slides: { title: string; text: string; notes?: string }[] };

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const tokenCap = Number(args.budget);
if (args.live !== "true" || !args.deck || !Number.isSafeInteger(tokenCap) || tokenCap <= 0) {
  throw new Error("Paid evaluation is disabled by default. Supply --live=true, --deck=<one-named-fixture>, and --budget=<token-cap> only after agreeing on spending. npm run check makes no API calls.");
}
const runs = Number(args.runs ?? 1);
const decks = (JSON.parse(readFileSync("tests/fixtures/eval-decks.json", "utf8")) as Fixture[]).filter((deck) => !args.deck || deck.name === args.deck);

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Run with: npm run eval");
  process.exit(1);
}

// Reserve input plus maximum output before every request, including parallel delivery reads.
// Token caps are not dollar caps: model rates and cache discounts differ.
const originalFetch = globalThis.fetch;
let spent = 0, reserved = 0;
globalThis.fetch = async (input, init) => {
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  if (!body?.model) return originalFetch(input, init);
  const reservation = Math.ceil(JSON.stringify(body).length / 2) + (body.max_output_tokens ?? 48000);
  if (spent + reserved + reservation > tokenCap) throw new Error("Evaluation token cap reached; no further API call was sent.");
  reserved += reservation;
  try {
    const response = await originalFetch(input, init);
    const result = await response.clone().json() as { usage?: { input_tokens: number; output_tokens: number } };
    spent += result.usage ? result.usage.input_tokens + result.usage.output_tokens : response.ok ? reservation : 0;
    console.log(`API usage: ${spent}/${tokenCap} tokens (input + output; reasoning included in output).`);
    return response;
  } finally { reserved -= reservation; }
};

const telemetry: import("../lib/ai/schemas").GenerationTelemetry[] = [];
let client = 0;
async function call<T>(route: (request: Request) => Promise<Response>, body: unknown): Promise<T> {
  // A distinct address per call keeps the route's per-client burst limit out of the way.
  const response = await route(new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(++client / 250) % 250}.${client % 250}` }, body: JSON.stringify(body) }));
  const json = await response.json() as { telemetry?: import("../lib/ai/schemas").GenerationTelemetry; [key: string]: unknown };
  if (json.telemetry) telemetry.push(json.telemetry);
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(json)}`);
  return json as T;
}

async function limit<T, R>(items: T[], size: number, work: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

const chunk = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function generate(fixture: Fixture) {
  const brief: Brief = { ...DEFAULT_BRIEF, ...fixture.brief };
  const input: BriefInput = { goal: brief.goal, audience: brief.audience, keyMessage: brief.keyMessage, mustInclude: brief.mustInclude, avoid: brief.avoid, presenterRole: brief.presenterRole, minutes: brief.minutes, qaMinutes: 0, wpm: brief.wpm, style: brief.style, depth: brief.depth, includeQuestions: false };
  const slides = fixture.slides.map((slide, index) => ({ id: `s${index + 1}`, index: index + 1, title: slide.title, text: slide.text, notes: slide.notes ?? "" }));
  const timings: Record<string, number> = {};
  const stage = async <T,>(name: string, work: () => Promise<T>) => {
    const started = Date.now();
    const result = await work();
    timings[name] = (Date.now() - started) / 1000;
    return result;
  };

  const analyses = new Map<string, SlideAnalysis | null>();
  await stage("analyze", () => limit(chunk(slides, 4), 4, async (batch) => {
    const result = await call<{ slides: { id: string; analysis: SlideAnalysis | null }[] }>(analyzeRoute, { fileName: `${fixture.name}.pdf`, slideCount: slides.length, slides: batch.map((slide) => ({ ...slide, image: null })) });
    for (const entry of result.slides) analyses.set(entry.id, entry.analysis);
  }));

  const deck = await stage("context", () => call<{ context: { title: string; topic: string; summary: string } }>(contextRoute, {
    fileName: `${fixture.name}.pdf`,
    slides: slides.map((slide) => ({ index: slide.index, title: slide.title, mainPoint: analyses.get(slide.id)?.mainPoint ?? "", kind: analyses.get(slide.id)?.kind ?? "content" })),
  }));
  const context = { title: deck.context.title, topic: deck.context.topic, summary: deck.context.summary };

  const plan = planPresentation(brief, slides.map((slide) => ({ id: slide.id, text: slide.text, analysis: analyses.get(slide.id) ?? null, optional: false, targetSeconds: null })));
  const targets = new Map(plan.slides.map((entry) => [entry.slideId, entry.words]));

  const outline = await stage("outline", () => call<{ arc: string; voice: string; slides: { id: string; role: string; keyIdea: string; transition: string }[] }>(outlineRoute, {
    brief: input, context, title: fixture.name,
    slides: slides.map((slide) => ({ id: slide.id, index: slide.index, title: slide.title, mainPoint: analyses.get(slide.id)?.mainPoint ?? "", kind: analyses.get(slide.id)?.kind ?? "content", targetWords: targets.get(slide.id) ?? 60, optional: false })),
  }));
  const planned = new Map(outline.slides.map((entry) => [entry.id, entry]));

  const requests: WriteRequest[] = chunk(slides, 4).map((batch) => ({
    brief: input, context, title: fixture.name, arc: outline.arc, voice: outline.voice, totalSlides: slides.length,
    slides: batch.map((slide) => {
      const analysis = analyses.get(slide.id);
      const previous = slides[slide.index - 2];
      return {
        ...slide,
        analysis: analysis ? { mainPoint: analysis.mainPoint, visualSummary: analysis.visualSummary, elements: analysis.elements, kind: analysis.kind, complexity: analysis.complexity, uncertain: analysis.uncertain } : null,
        role: planned.get(slide.id)?.role ?? "", keyIdea: planned.get(slide.id)?.keyIdea ?? "", transition: planned.get(slide.id)?.transition ?? "",
        previousTransition: previous ? planned.get(previous.id)?.transition ?? "" : "",
        targetWords: targets.get(slide.id) ?? 60, previousTitle: previous?.title ?? "", nextTitle: slides[slide.index]?.title ?? "",
      };
    }),
  }));
  const notes: unknown[] = [];
  const written = new Map<string, WrittenSlideOutput>();
  await stage("write", () => limit(requests, 6, async (request) => {
    const result = await call<{ slides: { id: string; script: WrittenSlideOutput | null }[]; notes?: unknown }>(writeRoute, request);
    if (result.notes) notes.push(result.notes);
    for (const entry of result.slides) if (entry.script) written.set(entry.id, entry.script);
  }));

  const sources = new Map(requests.flatMap((request) => request.slides.map((slide) => [slide.id, slideSource(slide, request.brief)])));
  return { brief: input, slides, targets, planned, outline, written, sources, analyses, timings, notes, telemetry: [...telemetry] };
}

function score(result: Awaited<ReturnType<typeof generate>>) {
  const { slides, targets, written, sources } = result;
  const rows = slides.map((slide) => {
    const script = written.get(slide.id);
    const paragraphs = script?.paragraphs ?? [];
    const words = paragraphsWords(paragraphs);
    const target = targets.get(slide.id) ?? 0;
    const opener = (splitSentences(paragraphs[0] ?? "")[0] ?? "").toLowerCase().replace(/[^a-z' ]/g, "").split(" ").slice(0, 2).join(" ");
    return {
      id: slide.id,
      missing: !script,
      fit: target ? words / target : 1,
      problems: spokenProblems(paragraphs, sources.get(slide.id)),
      invented: ungroundedFigures(paragraphs, sources.get(slide.id) ?? ""),
      opener,
    };
  });
  const openers = new Map<string, number>();
  for (const row of rows) if (row.opener) openers.set(row.opener, (openers.get(row.opener) ?? 0) + 1);
  const repeated = [...openers].filter(([, count]) => count > 1);
  return {
    rows,
    missing: rows.filter((row) => row.missing).length,
    fitError: rows.reduce((sum, row) => sum + Math.abs(row.fit - 1), 0) / rows.length,
    offBudget: rows.filter((row) => Math.abs(row.fit - 1) > 0.2).length,
    lint: rows.filter((row) => row.problems.length).length,
    invented: rows.flatMap((row) => row.invented),
    repeatedOpeners: repeated.map(([opener, count]) => `"${opener}" ×${count}`),
  };
}

function render(result: Awaited<ReturnType<typeof generate>>, scored: ReturnType<typeof score>) {
  const lines = [`Voice: ${result.outline.voice}`, ""];
  for (const slide of result.slides) {
    const script = result.written.get(slide.id);
    const row = scored.rows.find((item) => item.id === slide.id)!;
    lines.push(`### ${slide.index}. ${slide.title} — ${paragraphsWords(script?.paragraphs ?? [])}/${result.targets.get(slide.id)} words${row.problems.length ? ` — ⚠ ${row.problems.join(" ")}` : ""}`);
    if (!script) { lines.push("(missing)", ""); continue; }
    lines.push(...script.paragraphs);
    lines.push(`*Summary:* ${script.concise}`, `*Transition:* ${script.transition}`, "");
  }
  return lines.join("\n");
}

mkdirSync("outputs", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report: string[] = [];
console.log(`Eval with ${process.env.OPENAI_WRITER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17"} (writing) and ${process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17"} (everything else)\n`);
console.log("deck               run  time   fit±  off  lint  invented  repeated openers");
for (const fixture of decks) {
  for (let run = 1; run <= runs; run += 1) {
    const started = Date.now();
    try {
      telemetry.length = 0;
      const result = await generate(fixture);
      writeFileSync(`outputs/eval-${stamp}-${fixture.name}-${run}.json`, JSON.stringify(result, (_, value) => value instanceof Map ? Object.fromEntries(value) : value, 2));
      const scored = score(result);
      const seconds = (Date.now() - started) / 1000;
      const n = fixture.slides.length;
      console.log([
        fixture.name.padEnd(18), String(run).padStart(3), `${seconds.toFixed(0)}s`.padStart(6), `${(scored.fitError * 100).toFixed(0)}%`.padStart(5),
        `${scored.offBudget}/${n}`.padStart(5), `${scored.lint}/${n}`.padStart(5), String(scored.invented.length ? scored.invented.join(",") : "0").padStart(9).slice(0, 9),
        `  ${(scored.repeatedOpeners.join(" ") || "none").padEnd(22).slice(0, 22)}`,
      ].join(" "));
      if (scored.missing) console.log(`  ⚠ ${scored.missing} slide(s) came back without a script`);
      report.push(`## ${fixture.name} — run ${run} (${seconds.toFixed(0)}s; ${Object.entries(result.timings).map(([name, time]) => `${name} ${time.toFixed(0)}s`).join(", ")})`, "", render(result, scored), "");
    } catch (error) {
      console.log(`${fixture.name.padEnd(18)} ${String(run).padStart(3)}  failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
const file = `outputs/eval-${stamp}.md`;
writeFileSync(file, report.join("\n"));
console.log(`\nfit± = average distance from each slide's word target · off = slides more than 20% off · lint = slides failing the speech checks`);
console.log(`Full scripts: ${file}`);
