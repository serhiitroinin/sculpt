import type {
  BuildResult,
  ExportFormat,
  MeasureRequest,
  MeasureResult,
  WorkerRequest,
  WorkerResponse,
} from "../../shared/cad.ts";
import * as replicad from "replicad";
import { startKernel } from "./kernel.ts";
import { buildModel, type BuiltPart } from "./build.ts";
import { exportParts } from "./export.ts";
import { BuildError } from "./evaluate.ts";

const scope = self as unknown as DedicatedWorkerGlobalScope;

for (const [name, value] of Object.entries(replicad)) {
  (scope as unknown as Record<string, unknown>)[name] = value;
}
(scope as unknown as Record<string, unknown>).replicad = replicad;

let current: BuiltPart[] = [];

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

function partNamed(name: string): BuiltPart {
  const part = current.find((entry) => entry.name === name);
  if (!part) throw new Error(`No part is named "${name}". Parts: ${current.map((p) => p.name).join(", ") || "none"}.`);
  return part;
}

function measure(request: MeasureRequest): MeasureResult {
  if (request.kind === "bounding-box") {
    const parts = request.part ? [partNamed(request.part)] : current;
    if (parts.length === 0) throw new Error("There is no model yet.");
    const shape = parts.length === 1 ? parts[0]!.shape : undefined;
    const box = shape
      ? parts[0]!.report.boundingBox
      : parts.map((part) => part.report.boundingBox).reduce((a, b) => ({
          min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
          max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
          size: [0, 0, 0],
          center: [0, 0, 0],
        }));
    const size: [number, number, number] = [
      box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2],
    ];
    return {
      kind: request.kind,
      units: "mm",
      boundingBox: {
        min: box.min,
        max: box.max,
        size,
        center: [
          (box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2,
        ],
      },
    };
  }
  if (request.kind === "distance") {
    const [a, b] = [request.from, request.to];
    const value = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    return { kind: request.kind, units: "mm", value: Math.round(value * 1000) / 1000 };
  }
  const from = partNamed(request.from);
  const to = partNamed(request.to);
  const value = replicad.measureDistanceBetween(from.shape, to.shape);
  return {
    kind: request.kind,
    units: "mm",
    value: Math.round(value * 1000) / 1000,
    note: "Shortest distance between the two solids. Zero means they touch or overlap.",
  };
}

async function build(source: string): Promise<BuildResult> {
  try {
    const built = await buildModel(source);
    current = built.parts;
    return { ok: true, report: built.report, meshes: built.meshes };
  } catch (error) {
    if (error instanceof BuildError) return { ok: false, failure: error.failure };
    const failed = error instanceof Error ? error : new Error(String(error));
    return { ok: false, failure: { phase: "kernel", message: failed.message } };
  }
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    await startKernel();
    if (request.kind === "build") {
      const result = await build(request.source);
      const transfer = result.ok
        ? result.meshes.flatMap((mesh) => [
            mesh.vertices.buffer, mesh.normals.buffer, mesh.triangles.buffer, mesh.edges.buffer,
          ])
        : [];
      post({ id: request.id, kind: "build", result }, transfer as Transferable[]);
    } else if (request.kind === "measure") {
      post({ id: request.id, kind: "measure", result: measure(request.request) });
    } else {
      const data = await exportParts(current, request.format);
      post({ id: request.id, kind: "export", data, format: request.format }, [data.buffer as Transferable]);
    }
  } catch (error) {
    post({ id: request.id, kind: "failed", message: error instanceof Error ? error.message : String(error) });
  }
};

startKernel((ratio) => post({ id: 0, kind: "progress", ratio })).then(() => post({ id: 0, kind: "ready" }));
