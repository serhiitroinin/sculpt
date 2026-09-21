import { expect, test } from "bun:test";
import { startKernel } from "./kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { BuildError, locate } from "../src/renderer/cad/evaluate.ts";

await startKernel();

async function failure(source: string): Promise<BuildError["failure"]> {
  try {
    await buildModel(source);
  } catch (error) {
    if (error instanceof BuildError) return error.failure;
    throw error;
  }
  throw new Error("the build unexpectedly succeeded");
}

test("a syntax error is reported as a compile failure", async () => {
  const result = await failure("export function main() {\n  const a = ;\n  return [];\n}\n");
  expect(result.phase).toBe("compile");
  expect(result.message.length).toBeGreaterThan(0);
});

test("a kernel refusal is reported as a kernel failure", async () => {
  const result = await failure(
    "export function main() {\n  const box = makeBaseBox(10, 10, 10);\n  return [{ name: \"b\", shape: box.fillet(40) }];\n}\n",
  );
  expect(result.message.length).toBeGreaterThan(0);
  expect(result.phase).toBe("kernel");
});

test("a missing main is reported as a contract error", async () => {
  const result = await failure("export const x = 1;\n");
  expect(result.message).toContain("main");
});

test("a part without a 3D shape is refused", async () => {
  const result = await failure(
    "export function main() {\n  return [{ name: \"flat\", shape: drawCircle(5) }];\n}\n",
  );
  expect(result.message).toContain("not a 3D shape");
});

test("duplicate part names are refused", async () => {
  const result = await failure(
    "export function main() {\n  const b = makeBaseBox(5, 5, 5);\n  return [{ name: \"a\", shape: b }, { name: \"a\", shape: b }];\n}\n",
  );
  expect(result.message).toContain("unique");
});

test("a build reports structure and a tessellation per part", async () => {
  const built = await buildModel(
    "export function main() {\n  return [\n    { name: \"cube\", shape: makeBaseBox(20, 20, 20) },\n    { name: \"ball\", shape: makeSphere(6).translateZ(30) },\n  ];\n}\n",
  );
  expect(built.report.units).toBe("mm");
  expect(built.report.parts.map((part) => part.name)).toEqual(["cube", "ball"]);
  expect(built.report.parts[0]?.faceCount).toBe(6);
  expect(built.report.parts[0]?.volume).toBeCloseTo(8000, 0);
  expect(built.report.boundingBox.size).toEqual([20, 20, 36]);
  expect(built.meshes).toHaveLength(2);
  expect(built.meshes[0]?.triangles.length).toBe(36);
  expect(built.meshes[0]?.faceGroups).toHaveLength(6);
  expect(built.meshes[0]?.edges.length).toBeGreaterThan(0);
});

test("an unnamed part gets a positional name", async () => {
  const built = await buildModel("export function main() {\n  return [{ shape: makeSphere(4) }];\n}\n");
  expect(built.report.parts[0]?.name).toBe("part1");
});

test("a stack frame inside the script is turned into a line and a source line", () => {
  const source = "export function main() {\n  boom();\n}\n";
  const error = new Error("boom is not defined");
  error.stack = "ReferenceError: boom is not defined\n    at main (blob:sculpt/abc:2:3)\n";
  expect(locate(error, "blob:sculpt/abc", source)).toEqual({
    line: 2,
    column: 3,
    sourceLine: "  boom();",
  });
});

test("a stack without the script frame yields no position", () => {
  const error = new Error("nothing");
  error.stack = "Error: nothing\n    at somewhere (file:///x.js:1:1)\n";
  expect(locate(error, "blob:sculpt/abc", "a\n")).toEqual({});
});
