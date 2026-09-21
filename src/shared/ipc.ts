import type { MeasureRequest, MeasureResult, ModelReport } from "./cad.ts";
import type { EngineChoice, Pin, ProjectState, ProjectSummary, ReferenceImage } from "./project.ts";
import type { HarnessEventPayload } from "reins/protocol";

export interface EngineModel {
  id: string;
  label: string;
  description?: string;
  /** The effort levels this model takes, lowest first. Absent when it takes none. */
  efforts?: { id: string; label: string }[];
  defaultEffort?: string;
}

/** One account window (5-hour, weekly, per model) as the engine reports it. */
export interface EngineLimit {
  id: string;
  label: string;
  unit: string;
  usedPercent?: number;
  used?: number;
  limit?: number;
  remaining?: number;
  resetsAt?: string;
}

export interface EngineInfo {
  id: string;
  label: string;
  models: { status: string; message?: string; defaultModelId?: string; models: EngineModel[] };
  controls: { id: string; label: string; options: { id: string; label: string }[]; defaultValue?: string }[];
  limits: { status: string; message?: string; planLabel?: string; windows: EngineLimit[] };
}

export type ViewName = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom" | "current";

export interface RenderRequest {
  views: (ViewName | { azimuth: number; elevation: number })[];
  size: number;
  /** A thumbnail drops the bench so a 72 px tile still reads. */
  plain?: boolean;
}

export interface RenderedView {
  label: string;
  /** Base64 PNG without a data URL prefix. */
  data: string;
}

/** Work the renderer performs for a tool call that runs in the main process. */
export type CadRequest =
  | { op: "build"; source: string }
  | { op: "render"; request: RenderRequest }
  | { op: "measure"; request: MeasureRequest }
  | { op: "pins" }
  | { op: "restore"; source: string };

export type CadResponse =
  | { op: "build"; ok: true; report: ModelReport }
  | { op: "build"; ok: false; failure: import("./cad.ts").BuildFailure }
  | { op: "render"; views: RenderedView[] }
  | { op: "measure"; result: MeasureResult }
  | { op: "pins"; pins: Pin[] }
  | { op: "restore"; ok: boolean };

export interface StartTurn {
  projectId: string;
  text: string;
  engine: EngineChoice;
  pins: Pin[];
  camera?: { position: [number, number, number]; target: [number, number, number] };
  /** Base64 PNG of the user's current view, with the pins drawn on it. */
  view?: string;
  imageIds: string[];
}

export type MainEvent =
  | { kind: "cad-request"; id: number; request: CadRequest }
  | { kind: "turn-event"; payload: HarnessEventPayload }
  | { kind: "turn-ended"; status: string; message?: string }
  | { kind: "project"; project: ProjectState };

export interface Bridge {
  readonly debug: boolean;
  call(method: "engines.list", payload: null): Promise<EngineInfo[]>;
  call(method: "projects.list", payload: null): Promise<ProjectSummary[]>;
  call(method: "projects.create", payload: { name: string }): Promise<ProjectState>;
  call(method: "projects.open", payload: { id: string }): Promise<ProjectState>;
  call(method: "projects.rename", payload: { id: string; name: string }): Promise<ProjectState>;
  call(method: "projects.engine", payload: { id: string; engine: EngineChoice }): Promise<void>;
  call(method: "images.add", payload: { projectId: string; name: string; mediaType: string; data: string }): Promise<ReferenceImage>;
  call(method: "images.remove", payload: { projectId: string; imageId: string }): Promise<void>;
  call(method: "images.read", payload: { projectId: string; imageId: string }): Promise<string>;
  call(method: "assets.read", payload: { projectId: string; kind: "render" | "revision" | "image"; id: string }): Promise<string>;
  call(method: "revisions.select", payload: { projectId: string; number: number }): Promise<{ source: string }>;
  call(method: "revisions.source", payload: { projectId: string; number: number }): Promise<string>;
  call(method: "turn.start", payload: StartTurn): Promise<void>;
  call(method: "turn.followUp", payload: { text: string }): Promise<void>;
  call(method: "turn.cancel", payload: null): Promise<void>;
  call(method: "cad.result", payload: { id: number; ok: boolean; value?: CadResponse; error?: string }): Promise<void>;
  call(method: "file.save", payload: { name: string; data: string }): Promise<string | null>;
  subscribe(listener: (message: MainEvent) => void): () => void;
}
