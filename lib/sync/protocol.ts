/**
 * Presenter ↔ audience window protocol over BroadcastChannel (same browser profile, same origin).
 *
 * The audience window receives only what the room may see: which slide, whether the screen is
 * blanked, and whether the talk has ended. Scripts and cues never cross this channel. Every message
 * is versioned and validated, and state messages carry a sequence number so a stale message from
 * an earlier session can't move the audience backwards.
 */

export const PROTOCOL_VERSION = 1;

export type AudienceState = {
  v: 1;
  type: "state";
  seq: number;
  session: string;
  index: number;
  total: number;
  slideId: string;
  blank: boolean;
  ended: boolean;
};

export type AudienceCommand = "next" | "previous";

export type AudienceMessage =
  | { v: 1; type: "hello"; window: string }
  | { v: 1; type: "heartbeat"; window: string }
  | { v: 1; type: "bye"; window: string }
  | { v: 1; type: "command"; window: string; command: AudienceCommand };

export function channelName(projectId: string) {
  return `cueframe:present:${projectId}`;
}

export function audienceWindowName(projectId: string) {
  return `cueframe-audience-${projectId}`;
}

export function isAudienceState(value: unknown): value is AudienceState {
  const message = value as AudienceState;
  return Boolean(message) && message.v === PROTOCOL_VERSION && message.type === "state"
    && typeof message.seq === "number" && typeof message.session === "string"
    && Number.isInteger(message.index) && message.index >= 0
    && Number.isInteger(message.total) && message.total > 0
    && typeof message.slideId === "string" && typeof message.blank === "boolean" && typeof message.ended === "boolean";
}

export function isAudienceMessage(value: unknown): value is AudienceMessage {
  const message = value as AudienceMessage;
  if (!message || message.v !== PROTOCOL_VERSION || typeof (message as { window?: unknown }).window !== "string") return false;
  if (message.type === "command") return message.command === "next" || message.command === "previous";
  return message.type === "hello" || message.type === "heartbeat" || message.type === "bye";
}

/** A heartbeat older than this means the audience window was closed or frozen. */
export const HEARTBEAT_MS = 1500;
export const AUDIENCE_TIMEOUT_MS = 4500;
