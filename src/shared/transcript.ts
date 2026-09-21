import type { HarnessEventPayload, HarnessUsage } from "reins/protocol";

export interface TurnText {
  text: string;
  /** Set by a tool call: the next assistant text starts a new paragraph. */
  broken: boolean;
  thinkingMs: number;
  thinkingStartedAt: number | undefined;
  usage: HarnessUsage | undefined;
}

export const EMPTY_TURN: TurnText = {
  text: "",
  broken: false,
  thinkingMs: 0,
  thinkingStartedAt: undefined,
  usage: undefined,
};

/** A turn-completed event repeats usage with empty fields; keep the richer one. */
export function mergeUsage(current: HarnessUsage | undefined, next: HarnessUsage | undefined): HarnessUsage | undefined {
  if (!next) return current;
  if (!current) return next;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== null) merged[key] = value;
  }
  return merged as HarnessUsage;
}

/**
 * The single place that turns harness events into the text of one turn, so a
 * live stream and a replay produce the same paragraphs.
 */
export function reduceTurn(state: TurnText, payload: HarnessEventPayload, now = Date.now()): TurnText {
  if (payload.kind === "assistant-text") {
    const separator = state.broken && state.text.trim() !== "" ? "\n\n" : "";
    return { ...state, text: state.text + separator + payload.text, broken: false };
  }
  if (payload.kind === "thinking") {
    return { ...state, thinkingStartedAt: state.thinkingStartedAt ?? now };
  }
  if (payload.kind === "tool-started" || payload.kind === "tool-completed") {
    const thinkingMs = state.thinkingStartedAt === undefined
      ? state.thinkingMs
      : state.thinkingMs + (now - state.thinkingStartedAt);
    return { ...state, broken: true, thinkingMs, thinkingStartedAt: undefined };
  }
  if (payload.kind === "usage" || payload.kind === "turn-completed") {
    return { ...state, usage: mergeUsage(state.usage, payload.usage) };
  }
  return state;
}
