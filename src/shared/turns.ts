import type { ActivityDetail, TranscriptEntry } from "./project.ts";
import { plural } from "./plural.ts";

export type UserEntry = Extract<TranscriptEntry, { kind: "user" }>;
export type AgentEntry = Extract<TranscriptEntry, { kind: "agent" }>;
export type ActivityEntry = Extract<TranscriptEntry, { kind: "activity" }>;

export interface Turn {
  id: string;
  user: UserEntry | undefined;
  steps: ActivityEntry[];
  answer: AgentEntry | undefined;
  /** True while at least one step is still running and no answer arrived. */
  running: boolean;
}

/** One turn is the user message, the steps it caused, and the answer. */
export function groupTurns(transcript: TranscriptEntry[]): Turn[] {
  const order: string[] = [];
  const turns = new Map<string, Turn>();
  for (const entry of transcript) {
    const id = entry.turnId || entry.id;
    if (!turns.has(id)) {
      order.push(id);
      turns.set(id, { id, user: undefined, steps: [], answer: undefined, running: false });
    }
    const turn = turns.get(id)!;
    if (entry.kind === "user") turn.user = entry;
    else if (entry.kind === "agent") turn.answer = entry;
    else turn.steps.push(entry);
  }
  for (const turn of turns.values()) {
    turn.running = turn.answer === undefined && turn.steps.some((step) => step.status === "running");
  }
  return order.map((id) => turns.get(id)!);
}

export function turnDurationMs(turn: Turn): number {
  if (turn.answer?.durationMs !== undefined) return turn.answer.durationMs;
  return turn.steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
}

/** `0:07` while a turn runs, `23 s` once it is done. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`;
}

export function turnHeader(turn: Turn, elapsedMs: number): string {
  if (turn.running) return `Working for ${formatElapsed(elapsedMs)}`;
  const spent = formatDuration(turnDurationMs(turn));
  if (turn.answer?.status === "interrupted") return `Stopped after ${spent}`;
  if (turn.answer?.status === "error") return `Failed after ${spent}`;
  return `Worked for ${spent}`;
}

/** Only finished runs collapse, and never the live row. */
export function collapseSteps(steps: ActivityEntry[], keep = 2): {
  shown: ActivityEntry[];
  hidden: number;
} {
  const live = steps.some((step) => step.status === "running");
  if (live || steps.length < 3) return { shown: steps, hidden: 0 };
  return { shown: steps.slice(0, keep), hidden: steps.length - keep };
}

/** `60 × 40 × 48 mm`, to one decimal. */
export function formatSize(size: readonly number[]): string {
  return `${size.map((value) => Math.round(value * 10) / 10).join(" \u00d7 ")} mm`;
}

/**
 * A finished build row in two pieces, so the row can let the words truncate
 * and keep the size whole.
 */
export function buildRowText(detail: Extract<ActivityDetail, { kind: "build" }>): { label: string; size: string } {
  return {
    label: `Built REV ${String(detail.revision).padStart(2, "0")} \u00b7 ${plural(detail.report.parts.length, "part")}`,
    size: formatSize(detail.report.boundingBox.size),
  };
}
