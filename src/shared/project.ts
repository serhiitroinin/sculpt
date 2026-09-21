import type { ModelReport } from "./cad.ts";

export interface TurnUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  costUsd?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngineChoice {
  adapterId: string;
  model?: string;
  effort?: string;
  controls?: Record<string, string>;
}

export interface Revision {
  number: number;
  note: string;
  createdAt: string;
  report: ModelReport;
  /** True when an isometric thumbnail of this revision is stored. */
  thumbnail?: boolean;
}

export interface ReferenceImage {
  id: string;
  name: string;
  mediaType: string;
  addedAt: string;
  /** Set when the agent has actually received this image. */
  seenAt?: string;
}

export type ActivityStatus = "running" | "done" | "failed";

export type ActivityDetail =
  | { kind: "build"; revision: number; report: ModelReport; source: string; previousSource: string }
  | { kind: "build-failed"; message: string; line?: number; sourceLines: string[] }
  | { kind: "views"; renders: string[] }
  | { kind: "facts"; title: string; body: string }
  | { kind: "image"; imageId: string };

export type TranscriptEntry =
  | {
      kind: "user";
      id: string;
      turnId: string;
      at: string;
      text: string;
      pins: Pin[];
      viewAttached: boolean;
      view?: string;
      images: string[];
    }
  | {
      kind: "agent";
      id: string;
      turnId: string;
      at: string;
      text: string;
      thinkingMs?: number;
      usage?: TurnUsage;
      model?: string;
      engine?: string;
      durationMs?: number;
      status?: "completed" | "error" | "interrupted";
    }
  | {
      kind: "activity";
      id: string;
      turnId: string;
      at: string;
      tool: string;
      text: string;
      status: ActivityStatus;
      durationMs?: number;
      detail?: ActivityDetail;
    };

export interface Pin {
  index: number;
  point: [number, number, number];
  normal: [number, number, number];
  part: string;
  surface: string;
}

export interface ProjectState {
  summary: ProjectSummary;
  engine: EngineChoice | undefined;
  revisions: Revision[];
  currentRevision: number | undefined;
  source: string | undefined;
  images: ReferenceImage[];
  transcript: TranscriptEntry[];
}
