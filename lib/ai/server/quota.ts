import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { GenerationTelemetry } from "../schemas";
import { adminApp, hasAdminCredentials } from "./auth";

/**
 * Durable AI allowances in Firestore (Docs/PRODUCT_OVERVIEW.md section 25.5), enforced on the
 * server with the Admin SDK. Clients can read their own usage document but never write any of it.
 *
 *   config/limits                     optional overrides of DEFAULT_LIMITS (console-editable)
 *   usage/{UTC day}                   { tokens, reserved }            app-wide, first come
 *   usage/{UTC day}/users/{uid}       { tokens, reserved, generations }
 *
 * Each AI request reserves a conservative token estimate in a transaction before calling the
 * provider, then swaps it for the actual usage. If the outcome is unknown (the call failed after it
 * may have been billed) the reservation is kept as spent. Values are ceilings, not promises.
 */
export const DEFAULT_LIMITS = {
  userDailyTokens: 400_000,
  globalDailyTokens: 2_000_000,
  userDailyGenerations: 5,
};
export type Limits = typeof DEFAULT_LIMITS;

/** Upper-bound token reservation per call, by route. Reconciled against real usage afterwards. */
const RESERVATION: Record<string, number> = {
  analyze: 30_000,
  context: 15_000,
  outline: 15_000,
  write: 40_000,
  deliver: 20_000,
  rewrite: 15_000,
};
const DEFAULT_RESERVATION = 20_000;

/** Quotas apply only where the server can write Firestore (a service account is configured). */
export const quotasEnabled = () => hasAdminCredentials();

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export class QuotaError extends Error {
  constructor(message: string, readonly resetAt: string) {
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

export type Reservation = { day: string; uid: string; tokens: number };

/** Admits one AI call for `uid` or throws QuotaError. Pure decision, exported for tests. */
export function admit(
  stage: string,
  limit: Limits,
  user: { tokens: number; reserved: number; generations: number },
  global: { tokens: number; reserved: number },
) {
  const estimate = RESERVATION[stage] ?? DEFAULT_RESERVATION;
  if (stage === "outline" && user.generations >= limit.userDailyGenerations) {
    return { ok: false as const, message: `You've used today's ${limit.userDailyGenerations} script generations. They reset at midnight UTC.` };
  }
  if (user.tokens + user.reserved + estimate > limit.userDailyTokens) {
    return { ok: false as const, message: "You've used today's AI allowance. It resets at midnight UTC." };
  }
  if (global.tokens + global.reserved + estimate > limit.globalDailyTokens) {
    return { ok: false as const, message: "Cueframe has used today's shared AI allowance. It resets at midnight UTC." };
  }
  return { ok: true as const, estimate };
}

export async function reserve(uid: string, stage: string): Promise<Reservation> {
  const db = getFirestore(adminApp());
  const day = utcDay();
  const limit = await limits();
  const globalRef = db.doc(`usage/${day}`);
  const userRef = db.doc(`usage/${day}/users/${uid}`);
  return db.runTransaction(async (tx) => {
    const [global, user] = await Promise.all([tx.get(globalRef), tx.get(userRef)]);
    const decision = admit(
      stage,
      limit,
      { tokens: user.get("tokens") ?? 0, reserved: user.get("reserved") ?? 0, generations: user.get("generations") ?? 0 },
      { tokens: global.get("tokens") ?? 0, reserved: global.get("reserved") ?? 0 },
    );
    if (!decision.ok) throw new QuotaError(decision.message, nextReset());
    const at = FieldValue.serverTimestamp();
    tx.set(globalRef, { reserved: FieldValue.increment(decision.estimate), updatedAt: at }, { merge: true });
    tx.set(userRef, {
      reserved: FieldValue.increment(decision.estimate),
      ...(stage === "outline" ? { generations: FieldValue.increment(1) } : {}),
      updatedAt: at,
    }, { merge: true });
    return { day, uid, tokens: decision.estimate };
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
  batch.set(db.doc(`usage/${reservation.day}/users/${reservation.uid}`), update, { merge: true });
  await batch.commit();
}
