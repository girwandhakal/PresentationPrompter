import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { PILOT } from "../../pilot";
import { WRITE_BATCH, type GenerationTelemetry } from "../schemas";
import { adminApp, hasAdminCredentials } from "./auth";

/**
 * Durable AI allowances in Firestore (Docs/PRODUCT_OVERVIEW.md section 25.5), enforced on the
 * server with the Admin SDK. Clients can read their own usage document but never write any of it.
 *
 *   config/limits                     optional overrides of DEFAULT_LIMITS (console-editable)
 *   usage/{UTC day}                   { tokens, reserved }            app-wide, first come
 *   usage/{UTC day}/users/{uid}       { tokens, reserved, generations, inflight: { id: started ms } }
 *   credits/{uid}                     { write, expiresAt }   write calls left for the current draft
 *
 * Each AI request reserves the most tokens it could possibly use (worstCaseTokens) in a transaction
 * before calling the provider, then swaps it for the actual usage. If the outcome is unknown (the
 * call failed after it may have been billed) the reservation is kept as spent. Because every
 * reservation is an upper bound, calls running at once can't spend past an allowance.
 *
 * A generation is counted when its outline is admitted, and the outline grants the write calls that
 * draft needs. Write calls without those credits are refused, so the daily generation cap can't be
 * skipped by calling the write route directly. Values are ceilings, not promises.
 */
export const DEFAULT_LIMITS = {
  userDailyTokens: 400_000,
  globalDailyTokens: 2_000_000,
  userDailyGenerations: PILOT.dailyScripts,
  /** AI calls one account may have running at once; generation runs three at a time. */
  userConcurrentCalls: 6,
};
export type Limits = typeof DEFAULT_LIMITS;

/** Fixed parts of a call's worst-case estimate. Instructions are under ~6k characters besides the brief. */
const INSTRUCTION_TOKENS = 5_000;
/** Above what OpenAI charges for one high-detail image, including the small models' higher multipliers. */
const IMAGE_TOKENS = 4_000;

/**
 * The most tokens one AI call can use. Request text counts at UTF-8 bytes / 2, which errs high for
 * every script (English runs about 4 bytes a token, CJK about 3); each image and the instructions
 * get a flat allowance; output counts at the max_output_tokens the call sends.
 */
export function worstCaseTokens({ textBytes, images, maxOutput }: { textBytes: number; images: number; maxOutput: number }) {
  return Math.ceil(textBytes / 2) + images * IMAGE_TOKENS + INSTRUCTION_TOKENS + maxOutput;
}

/** The client tries each request up to three times (aiFetch in lib/ai/client.ts). */
const WRITE_ATTEMPTS = 3;
/** Write calls an outline grants for a draft of `slideCount` slides. */
export const writeCallsFor = (slideCount: number) => Math.ceil(slideCount / WRITE_BATCH) * WRITE_ATTEMPTS;
/** How long a draft's write credits last after its outline. */
const CREDIT_TTL_MS = 60 * 60 * 1000;
/** A call still marked as running after this long died without settling; it no longer counts. */
const LEASE_MS = 5 * 60 * 1000;

/**
 * Operators exempt from every allowance, by verified sign-in email: QUOTA_EXEMPT_EMAILS is a
 * comma-separated list (server-side only). Their calls are still reserved and recorded in the
 * usage ledger, so shared totals stay accurate; they are just never refused.
 */
export function quotaExempt(email: string | null, list = process.env.QUOTA_EXEMPT_EMAILS ?? "") {
  if (!email) return false;
  return list.split(",").some((entry) => entry.trim().toLowerCase() === email.toLowerCase());
}

/** Quotas apply only where the server can write Firestore (a service account is configured). */
export const quotasEnabled = () => hasAdminCredentials();

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export class QuotaError extends Error {
  /** `busy` refusals clear when the account's running calls finish; the others reset at `resetAt`. */
  constructor(message: string, readonly resetAt: string, readonly busy = false) {
    super(message);
    this.name = "QuotaError";
  }
}

let cachedLimits: { value: Limits; at: number } | null = null;

async function limits(): Promise<Limits> {
  if (cachedLimits && Date.now() - cachedLimits.at < 60_000) return cachedLimits.value;
  const snapshot = await getFirestore(adminApp()).doc("config/limits").get();
  const stored = (snapshot.data() ?? {}) as Partial<Limits>;
  const value = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(value) as (keyof Limits)[]) {
    const override = Number(stored[key]);
    if (Number.isFinite(override) && override >= 0) value[key] = override;
  }
  cachedLimits = { value, at: Date.now() };
  return value;
}

export function usedTokens(telemetry: GenerationTelemetry | undefined) {
  return (telemetry?.calls ?? []).reduce((sum, call) => sum + call.inputTokens + call.outputTokens, 0);
}

/** Next UTC midnight, when daily allowances reset. */
function nextReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export type Reservation = { day: string; uid: string; tokens: number; id: string };

export type UserUsage = { tokens: number; reserved: number; generations: number; running: number; writeCredits: number };

/** Admits one AI call of `estimate` tokens or explains why not. Pure decision, exported for tests. */
export function admit(
  stage: string,
  estimate: number,
  limit: Limits,
  user: UserUsage,
  global: { tokens: number; reserved: number },
  exempt = false,
): { ok: true } | { ok: false; message: string; busy?: true } {
  if (exempt) return { ok: true };
  if (user.running >= limit.userConcurrentCalls) {
    return { ok: false, busy: true, message: "Several AI requests are already running for your account. Wait a moment and try again." };
  }
  if (stage === "outline" && user.generations >= limit.userDailyGenerations) {
    return { ok: false, message: `You've used today's ${limit.userDailyGenerations} script generations. They reset at midnight UTC.` };
  }
  if (stage === "write" && user.writeCredits <= 0) {
    return { ok: false, message: "This draft can't write more slides. Generate the draft again." };
  }
  if (user.tokens + user.reserved + estimate > limit.userDailyTokens) {
    return { ok: false, message: "You've used today's AI allowance. It resets at midnight UTC." };
  }
  if (global.tokens + global.reserved + estimate > limit.globalDailyTokens) {
    return { ok: false, message: "Cueframe has used today's shared AI allowance. It resets at midnight UTC." };
  }
  return { ok: true };
}

/**
 * Admits one AI call for `uid` or throws QuotaError. `grantWrites` is how many write calls an
 * admitted outline unlocks for its draft.
 */
export async function reserve(uid: string, { stage, estimate, exempt = false, grantWrites = 0 }: { stage: string; estimate: number; exempt?: boolean; grantWrites?: number }): Promise<Reservation> {
  const db = getFirestore(adminApp());
  const day = utcDay();
  const limit = await limits();
  const globalRef = db.doc(`usage/${day}`);
  const userRef = db.doc(`usage/${day}/users/${uid}`);
  const creditRef = db.doc(`credits/${uid}`);
  const id = randomUUID();
  return db.runTransaction(async (tx) => {
    const [global, user, credit] = await Promise.all([tx.get(globalRef), tx.get(userRef), tx.get(creditRef)]);
    const now = Date.now();
    const inflight = (user.get("inflight") ?? {}) as Record<string, unknown>;
    const stale = Object.keys(inflight).filter((key) => !(typeof inflight[key] === "number" && (inflight[key] as number) > now - LEASE_MS));
    const writeCredits = Number(credit.get("expiresAt") ?? 0) > now ? Number(credit.get("write") ?? 0) : 0;
    const decision = admit(
      stage,
      estimate,
      limit,
      {
        tokens: user.get("tokens") ?? 0,
        reserved: user.get("reserved") ?? 0,
        generations: user.get("generations") ?? 0,
        running: Object.keys(inflight).length - stale.length,
        writeCredits,
      },
      { tokens: global.get("tokens") ?? 0, reserved: global.get("reserved") ?? 0 },
      exempt,
    );
    if (!decision.ok) throw new QuotaError(decision.message, nextReset(), decision.busy);
    const at = FieldValue.serverTimestamp();
    tx.set(globalRef, { reserved: FieldValue.increment(estimate), updatedAt: at }, { merge: true });
    tx.set(userRef, {
      reserved: FieldValue.increment(estimate),
      inflight: { [id]: now, ...Object.fromEntries(stale.map((key) => [key, FieldValue.delete()])) },
      ...(stage === "outline" ? { generations: FieldValue.increment(1) } : {}),
      updatedAt: at,
    }, { merge: true });
    if (grantWrites > 0) tx.set(creditRef, { write: writeCredits + grantWrites, expiresAt: now + CREDIT_TTL_MS, updatedAt: at });
    else if (stage === "write" && !exempt) tx.set(creditRef, { write: FieldValue.increment(-1), updatedAt: at }, { merge: true });
    return { day, uid, tokens: estimate, id };
  });
}

/**
 * Replaces a reservation with actual usage. `actual` is null when billing is uncertain; the
 * whole reservation then counts as spent.
 */
export async function settle(reservation: Reservation, actual: number | null) {
  const db = getFirestore(adminApp());
  const spent = actual ?? reservation.tokens;
  const update = { reserved: FieldValue.increment(-reservation.tokens), tokens: FieldValue.increment(spent), updatedAt: FieldValue.serverTimestamp() };
  const batch = db.batch();
  batch.set(db.doc(`usage/${reservation.day}`), update, { merge: true });
  batch.set(db.doc(`usage/${reservation.day}/users/${reservation.uid}`), { ...update, inflight: { [reservation.id]: FieldValue.delete() } }, { merge: true });
  await batch.commit();
}
