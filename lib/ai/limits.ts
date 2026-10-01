/**
 * Request limits shared by the browser and the AI routes. Kept free of imports so the client can use
 * them without bundling the zod schemas.
 */

/**
 * Slides per write call: keeps neighbors in one voice and pays for the instructions once per four.
 * The orchestrator batches by it; quotas grant each draft's write calls by it.
 */
export const WRITE_BATCH = 4;

/** A slide's current script sent for a rewrite: about 5,000 words in all, beyond any one slide's spoken length. */
export const SCRIPT_LIMITS = { paragraphs: 40, paragraphChars: 4000, totalChars: 30_000 };

/** A script within the rewrite route's limits; a very long one is sent from its start. */
export function fitScriptParagraphs(paragraphs: string[]) {
  let budget = SCRIPT_LIMITS.totalChars;
  const fitted: string[] = [];
  for (const paragraph of paragraphs.slice(0, SCRIPT_LIMITS.paragraphs)) {
    if (budget <= 0) break;
    const kept = paragraph.slice(0, Math.min(SCRIPT_LIMITS.paragraphChars, budget));
    fitted.push(kept);
    budget -= kept.length;
  }
  return fitted;
}
