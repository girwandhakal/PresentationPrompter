/**
 * Script-generation eval: runs fixture decks through the real AI routes, the same pipeline the app
 * runs (analyze → context → plan → outline → write → deliver), and scores what comes back.
 *
 *   npm run eval                      every deck once
 *   npm run eval -- --runs=3          repeat, to see run-to-run spread
 *   npm run eval -- --deck=launch-pitch
 *
 * Needs OPENAI_API_KEY in .env.local. Full scripts are written to outputs/ for reading; the console
 * shows the scores. Rerun after any prompt or model change and compare.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { POST as analyzeRoute } from "../app/api/ai/analyze/route";
import { POST as contextRoute } from "../app/api/ai/context/route";
import { POST as deliverRoute } from "../app/api/ai/deliver/route";
import { POST as outlineRoute } from "../app/api/ai/outline/route";
import { POST as writeRoute } from "../app/api/ai/write/route";
import type { BriefInput, DeliveredSlide, WriteRequest, WrittenSlideOutput } from "../lib/ai/schemas";
import { spokenProblems, ungroundedFigures, writeSources } from "../lib/ai/server/spoken-lint";
import { paragraphsWords } from "../lib/ai/validate";
import { placeDelivery } from "../lib/domain/cues";
import { DEFAULT_BRIEF, planPresentation } from "../lib/domain/planner";
import { documentFromAi, splitSentences } from "../lib/domain/script";
import type { Brief, SlideAnalysis } from "../lib/domain/types";

type Fixture = { name: string; brief: Partial<Brief>; slides: { title: string; text: string; notes?: string }[] };

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const runs = Number(args.runs ?? 1);
const decks = (JSON.parse(readFileSync("tests/fixtures/eval-decks.json", "utf8")) as Fixture[]).filter((deck) => !args.deck || deck.name === args.deck);

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Run with: npm run eval");
  process.exit(1);
}

let client = 0;
async function call<T>(route: (request: Request) => Promise<Response>, body: unknown): Promise<T> {
  // A distinct address per call keeps the route's per-client burst limit out of the way.
  const response = await route(new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(++client / 250) % 250}.${client % 250}` }, body: JSON.stringify(body) }));
  const json = await response.json();
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
  const input: BriefInput = { goal: brief.goal, audience: brief.audience, keyMessage: brief.keyMessage, mustInclude: brief.mustInclude, avoid: brief.avoid, presenterRole: brief.presenterRole, minutes: brief.minutes, qaMinutes: 0, wpm: brief.wpm, style: brief.style, depth: brief.depth, cueDensity: brief.cueDensity, includeQuestions: false };
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

  const requests: WriteRequest[] = chunk(slides, 2).map((batch) => ({
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
  const written = new Map<string, WrittenSlideOutput>();
  await stage("write", () => limit(requests, 6, async (request) => {
    const result = await call<{ slides: { id: string; script: WrittenSlideOutput | null }[] }>(writeRoute, request);
    for (const entry of result.slides) if (entry.script) written.set(entry.id, entry.script);
  }));

  const delivered = await stage("deliver", () => call<{ slides: DeliveredSlide[] }>(deliverRoute, {
    density: input.cueDensity,
    slides: slides.map((slide) => ({ id: slide.id, title: slide.title, kind: analyses.get(slide.id)?.kind ?? "content", keyIdea: planned.get(slide.id)?.keyIdea ?? "", first: slide.index === 1, paragraphs: written.get(slide.id)?.paragraphs ?? [] })),
  }));
  for (const entry of delivered.slides) {
    const script = written.get(entry.id);
    if (script) written.set(entry.id, { ...script, cues: entry.cues, marks: entry.marks });
  }

  const sources = new Map(requests.flatMap((request) => [...writeSources(request)]));
  return { brief: input, slides, targets, planned, outline, written, sources, analyses, timings };
}

function score(result: Awaited<ReturnType<typeof generate>>) {
  const { slides, targets, written, sources, brief, analyses, planned } = result;
  const rows = slides.map((slide) => {
    const script = written.get(slide.id);
    const paragraphs = script?.paragraphs ?? [];
    const words = paragraphsWords(paragraphs);
    const target = targets.get(slide.id) ?? 0;
    const opener = (splitSentences(paragraphs[0] ?? "")[0] ?? "").toLowerCase().replace(/[^a-z' ]/g, "").split(" ").slice(0, 2).join(" ");
    const rules = placeDelivery({ paragraphs, density: brief.cueDensity, seed: slide.id, title: slide.title, keyIdea: planned.get(slide.id)?.keyIdea, kind: analyses.get(slide.id)?.kind ?? "content", first: slide.index === 1 });
    return {
      id: slide.id,
      missing: !script,
      fit: target ? words / target : 1,
      problems: spokenProblems(paragraphs, sources.get(slide.id)),
      invented: ungroundedFigures(paragraphs, sources.get(slide.id) ?? ""),
      opener,
      pauses: script?.cues.length ?? 0,
      bold: script?.marks.filter((mark) => mark.mark === "bold").length ?? 0,
      slow: script?.marks.filter((mark) => mark.mark === "slow").length ?? 0,
      coached: JSON.stringify({ cues: script?.cues, marks: script?.marks }) !== JSON.stringify(rules),
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
    pauses: rows.reduce((sum, row) => sum + row.pauses, 0),
    bold: rows.reduce((sum, row) => sum + row.bold, 0),
    slow: rows.reduce((sum, row) => sum + row.slow, 0),
    noGuidance: rows.filter((row) => !row.pauses && !row.bold && !row.slow).length,
    coached: rows.filter((row) => row.coached).length,
  };
}

function render(result: Awaited<ReturnType<typeof generate>>, scored: ReturnType<typeof score>) {
  const lines = [`Voice: ${result.outline.voice}`, ""];
  for (const slide of result.slides) {
    const script = result.written.get(slide.id);
    const row = scored.rows.find((item) => item.id === slide.id)!;
    lines.push(`### ${slide.index}. ${slide.title} — ${paragraphsWords(script?.paragraphs ?? [])}/${result.targets.get(slide.id)} words${row.problems.length ? ` — ⚠ ${row.problems.join(" ")}` : ""}`);
    if (!script) { lines.push("(missing)", ""); continue; }
    const document = documentFromAi(script.paragraphs, script.cues.map((cue) => ({ paragraph: cue.paragraph, afterSentence: cue.afterSentence, label: cue.text })), script.marks);
    for (const paragraph of document.paragraphs) {
      lines.push(paragraph.children.map((child) => child.type === "cue" ? `> **[${child.label}]**` : child.type === "text" ? (child.slow ? `〔slow: ${child.bold ? `**${child.text}**` : child.text}〕` : child.bold ? `**${child.text}**` : child.text) : "").join(""));
    }
    lines.push(`*Summary:* ${script.concise}`, `*Transition:* ${script.transition}`, "");
  }
  return lines.join("\n");
}

mkdirSync("outputs", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report: string[] = [];
console.log(`Eval with ${process.env.OPENAI_MODEL ?? "gpt-5.4-mini"} (writing) and ${process.env.OPENAI_DELIVERY_MODEL ?? "gpt-5.4"} (delivery)\n`);
console.log("deck               run  time   fit±  off  lint  invented  repeated openers        pauses bold slow  none  coached");
for (const fixture of decks) {
  for (let run = 1; run <= runs; run += 1) {
    const started = Date.now();
    try {
      const result = await generate(fixture);
      const scored = score(result);
      const seconds = (Date.now() - started) / 1000;
      const n = fixture.slides.length;
      console.log([
        fixture.name.padEnd(18), String(run).padStart(3), `${seconds.toFixed(0)}s`.padStart(6), `${(scored.fitError * 100).toFixed(0)}%`.padStart(5),
        `${scored.offBudget}/${n}`.padStart(5), `${scored.lint}/${n}`.padStart(5), String(scored.invented.length ? scored.invented.join(",") : "0").padStart(9).slice(0, 9),
        `  ${(scored.repeatedOpeners.join(" ") || "none").padEnd(22).slice(0, 22)}`, String(scored.pauses).padStart(6), String(scored.bold).padStart(4), String(scored.slow).padStart(4),
        `${scored.noGuidance}/${n}`.padStart(6), `${scored.coached}/${n}`.padStart(8),
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
console.log(`none = slides with no pause, bold or slow · coached = slides where the AI coach's marks differ from the rule fallback`);
console.log(`Full scripts: ${file}`);
