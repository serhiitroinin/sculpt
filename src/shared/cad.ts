export interface PartMesh {
  name: string;
  color: string;
  /** Interleaved xyz, millimetres, model space. */
  vertices: Float32Array;
  normals: Float32Array;
  triangles: Uint32Array;
  /** Flattened line segments for the B-rep edges: x0,y0,z0,x1,y1,z1,... */
  edges: Float32Array;
  /** Triangle-index ranges that belong to one kernel face. */
  faceGroups: FaceGroup[];
}

export interface FaceGroup {
  start: number;
  count: number;
  faceId: number;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
}

export interface PartReport {
  name: string;
  color: string;
  volume: number;
  surfaceArea: number;
  faceCount: number;
  edgeCount: number;
  boundingBox: BoundingBox;
}

export interface ModelReport {
  units: "mm";
  parts: PartReport[];
  boundingBox: BoundingBox;
}

export interface BuildFailure {
  message: string;
  line?: number;
  column?: number;
  sourceLine?: string;
  phase: "compile" | "run" | "kernel" | "timeout";
}

export type BuildResult =
  | { ok: true; report: ModelReport; meshes: PartMesh[] }
  | { ok: false; failure: BuildFailure };

export type MeasureRequest =
  | { kind: "bounding-box"; part?: string }
  | { kind: "distance"; from: [number, number, number]; to: [number, number, number] }
  | { kind: "part-distance"; from: string; to: string };

export interface MeasureResult {
  kind: string;
  units: "mm";
  value?: number;
  boundingBox?: BoundingBox;
  note?: string;
}

export type ExportFormat = "step" | "stl";

export type WorkerRequest =
  | { id: number; kind: "build"; source: string }
  | { id: number; kind: "measure"; request: MeasureRequest }
  | { id: number; kind: "export"; format: ExportFormat };

export type WorkerResponse =
  | { id: number; kind: "build"; result: BuildResult }
  | { id: number; kind: "measure"; result: MeasureResult }
  | { id: number; kind: "export"; data: Uint8Array; format: ExportFormat }
  | { id: number; kind: "failed"; message: string }
  | { id: number; kind: "progress"; ratio: number }
  | { id: number; kind: "ready" };
