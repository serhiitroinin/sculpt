import type { AnyShape, Shape3D } from "replicad";
import type { BoundingBox, ModelReport, PartMesh, PartReport } from "../../shared/cad.ts";
import * as replicad from "replicad";
import { BuildError, evaluateModel, type ModelPart } from "./evaluate.ts";

const PALETTE = ["#9fb2c4", "#c7a98b", "#8faa93", "#b49bb4", "#b9a06a", "#8a9cb0"];
const MESH_OPTIONS = { tolerance: 0.05, angularTolerance: 0.25 };

export interface BuiltPart extends ModelPart {
  shape: Shape3D;
  color: string;
  report: PartReport;
}

function boxOf(shape: AnyShape): BoundingBox {
  const box = shape.boundingBox;
  const [min, max] = box.bounds;
  return {
    min: [...min],
    max: [...max],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [...box.center],
  };
}

function mergeBoxes(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, box.min[axis]!);
      max[axis] = Math.max(max[axis]!, box.max[axis]!);
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

function isShape3D(shape: unknown): shape is Shape3D {
  const candidate = shape as { wrapped?: unknown; mesh?: unknown };
  return typeof candidate?.mesh === "function" && candidate.wrapped !== undefined;
}

function describe(part: ModelPart, index: number): BuiltPart {
  if (!isShape3D(part.shape)) {
    throw new BuildError({
      phase: "run",
      message: `Part "${part.name}" is not a 3D shape. Extrude, revolve or sweep a sketch first.`,
    });
  }
  const shape = part.shape;
  return {
    ...part,
    shape,
    color: part.color ?? PALETTE[index % PALETTE.length]!,
    report: {
      name: part.name,
      color: part.color ?? PALETTE[index % PALETTE.length]!,
      volume: round(replicad.measureVolume(shape)),
      surfaceArea: round(replicad.measureShapeSurfaceProperties(shape).area),
      faceCount: shape.faces.length,
      edgeCount: shape.edges.length,
      boundingBox: roundBox(boxOf(shape)),
    },
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundBox(box: BoundingBox): BoundingBox {
  return {
    min: box.min.map(round) as [number, number, number],
    max: box.max.map(round) as [number, number, number],
    size: box.size.map(round) as [number, number, number],
    center: box.center.map(round) as [number, number, number],
  };
}

function tessellate(part: BuiltPart): PartMesh {
  const mesh = part.shape.mesh(MESH_OPTIONS);
  const edges = part.shape.meshEdges(MESH_OPTIONS);
  return {
    name: part.name,
    color: part.color,
    vertices: new Float32Array(mesh.vertices),
    normals: new Float32Array(mesh.normals),
    triangles: new Uint32Array(mesh.triangles),
    edges: new Float32Array(edges.lines),
    faceGroups: mesh.faceGroups.map((group) => ({ ...group })),
  };
}

export async function buildModel(source: string): Promise<{
  report: ModelReport;
  meshes: PartMesh[];
  parts: BuiltPart[];
}> {
  const parts = (await evaluateModel(source)).map(describe);
  if (parts.length === 0) {
    throw new BuildError({ phase: "run", message: "main() returned no parts." });
  }
  const names = new Set<string>();
  for (const part of parts) {
    if (names.has(part.name)) {
      throw new BuildError({ phase: "run", message: `Two parts are named "${part.name}". Names must be unique.` });
    }
    names.add(part.name);
  }
  return {
    report: {
      units: "mm",
      parts: parts.map((part) => part.report),
      boundingBox: roundBox(mergeBoxes(parts.map((part) => part.report.boundingBox))),
    },
    meshes: parts.map(tessellate),
    parts,
  };
}
