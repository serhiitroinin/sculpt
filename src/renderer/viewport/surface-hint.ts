import type { FaceGroup } from "../../shared/cad.ts";

export interface FacetSource {
  faceGroups: FaceGroup[];
  normals: Float32Array;
  triangles: Uint32Array;
}

function groupFor(faceGroups: FaceGroup[], faceIndex: number): FaceGroup | undefined {
  const index = faceIndex * 3;
  return faceGroups.find((group) => index >= group.start && index < group.start + group.count);
}

/**
 * The kernel face id is not stable across rebuilds, so the hint is measured
 * from the triangles of the hit face instead: equal normals mean a plane, and
 * normals that all stay perpendicular to one axis mean a cylinder or a cone.
 */
export function classifyFace(source: FacetSource, faceIndex: number): string {
  const group = groupFor(source.faceGroups, faceIndex);
  if (!group || group.count < 3) return "unknown";
  const normals: [number, number, number][] = [];
  for (let offset = group.start; offset < group.start + group.count; offset += 1) {
    const vertex = source.triangles[offset];
    if (vertex === undefined) continue;
    normals.push([
      source.normals[vertex * 3] ?? 0,
      source.normals[vertex * 3 + 1] ?? 0,
      source.normals[vertex * 3 + 2] ?? 0,
    ]);
    if (normals.length >= 64) break;
  }
  if (normals.length === 0) return "unknown";
  const first = normals[0]!;
  const planar = normals.every((normal) =>
    Math.abs(normal[0] * first[0] + normal[1] * first[1] + normal[2] * first[2]) > 0.9995);
  if (planar) return "planar";
  for (const axis of [0, 1, 2] as const) {
    if (normals.every((normal) => Math.abs(normal[axis]) < 0.02)) {
      return `cylindrical about ${"XYZ"[axis]}`;
    }
  }
  return "curved";
}
