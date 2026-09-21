import { expect, test } from "bun:test";
import { classifyFace } from "../src/renderer/viewport/surface-hint.ts";

const flat = {
  faceGroups: [{ start: 0, count: 6, faceId: 1 }],
  triangles: new Uint32Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
};

test("a face whose triangles share one normal is planar", () => {
  expect(classifyFace(flat, 0)).toBe("planar");
});

test("normals that stay perpendicular to Z read as a cylinder about Z", () => {
  const source = {
    faceGroups: [{ start: 0, count: 6, faceId: 1 }],
    triangles: new Uint32Array([0, 1, 2, 1, 2, 3]),
    normals: new Float32Array([1, 0, 0, 0.7, 0.71, 0, 0, 1, 0, -0.7, 0.71, 0]),
  };
  expect(classifyFace(source, 0)).toBe("cylindrical about Z");
});

test("a doubly curved face is reported as curved", () => {
  const source = {
    faceGroups: [{ start: 0, count: 6, faceId: 1 }],
    triangles: new Uint32Array([0, 1, 2, 1, 2, 3]),
    normals: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 0.5, 0.7]),
  };
  expect(classifyFace(source, 0)).toBe("curved");
});

test("a triangle outside every face group is unknown", () => {
  expect(classifyFace(flat, 40)).toBe("unknown");
});
