/**
 * Pilot allowances as the public site states them. The server enforces the same defaults: the
 * account cap in `functions/src/index.ts` (DEFAULT_MAX_ACCOUNTS) and the daily script cap in
 * `lib/ai/server/quota.ts` (DEFAULT_LIMITS). A unit test keeps the three in step. Operators can
 * lower either in the Firebase console, which is why the site says "up to".
 */
export const PILOT = {
  accounts: 10,
  dailyScripts: 5,
};

/** The footnote behind every "limited seats*" on the landing page. */
export const PILOT_TERMS = `The pilot is limited to ${PILOT.accounts} accounts and up to ${PILOT.dailyScripts} scripts per account per day. Limits can change, and the pilot will end.`;
