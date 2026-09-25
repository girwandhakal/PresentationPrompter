import { parseScriptDocument } from "../domain/script";
import { DEFAULT_BRIEF, emptyScript } from "../domain/planner";
import type { Project } from "../domain/types";
import { putProject } from "./db";

const LEGACY_KEY = "cueframe-presentations-v2";
const MIGRATED_KEY = "cueframe-migrated-v2";
/** Sample decks that older builds seeded automatically; they are not user work. */
const LEGACY_SAMPLE_IDS = new Set(["quiet-launch", "research-review", "team-update"]);

type LegacyRecord = Record<string, unknown>;

/** One-time move of decks saved by the previous localStorage-based build into IndexedDB. */
export async function migrateLegacyStorage() {
  let raw: string | null = null;
  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) return 0;
    raw = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return 0;
  }

  let migrated = 0;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LegacyRecord[];
      for (const record of Array.isArray(parsed) ? parsed : []) {
        const project = legacyToProject(record);
        if (project) {
          await putProject(project);
          migrated += 1;
        }
      }
    } catch {
      // Unreadable legacy data is left in place rather than destroyed.
      return 0;
    }
  }

  try {
    window.localStorage.setItem(MIGRATED_KEY, String(Date.now()));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch { /* best effort */ }
  return migrated;
}

function legacyToProject(record: LegacyRecord): Project | null {
  const id = String(record.id ?? "");
  if (!id || LEGACY_SAMPLE_IDS.has(id) || !Array.isArray(record.slides) || !record.slides.length) return null;
  const now = Date.now();
  const minutes = Number(record.durationMinutes) || DEFAULT_BRIEF.minutes;
  return {
    id,
    title: String(record.title ?? "Untitled presentation"),
    createdAt: now,
    updatedAt: now,
    status: "ready",
    source: { fileName: "Imported from an earlier version", kind: "pdf", bytes: 0 },
    aspectRatio: 16 / 9,
    slides: (record.slides as LegacyRecord[]).map((slide, index) => {
      const title = String(slide.title ?? `Slide ${index + 1}`);
      const document = parseScriptDocument(slide.script, String(slide.body ?? ""), String(slide.cue ?? ""));
      return {
        id: String(slide.id ?? `${id}-${index + 1}`),
        sourceIndex: index + 1,
        title,
        text: [slide.eyebrow, title].filter(Boolean).join("\n"),
        notes: "",
        imageKey: "",
        thumbKey: "",
        width: 1920,
        height: 1080,
        warnings: [],
        optional: false,
        targetSeconds: null,
        analysis: null,
        script: { ...emptyScript(), document, purpose: String(slide.marker ?? ""), origin: "user" as const },
      };
    }),
    brief: { ...DEFAULT_BRIEF, goal: String(record.goal ?? ""), audience: String(record.audience ?? ""), minutes },
    context: null,
    analysis: { status: "idle" },
    generation: { status: "idle" },
    generatedWith: { minutes, qaMinutes: 0, wpm: DEFAULT_BRIEF.wpm, depth: "full" },
    lastPresentedAt: null,
  };
}
