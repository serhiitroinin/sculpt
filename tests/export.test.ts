import { expect, test } from "bun:test";
import { startKernel } from "./kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { exportParts } from "../src/renderer/cad/export.ts";

await startKernel();

const SOURCE = `export function main() {
  return [
    { name: "block", shape: makeBaseBox(30, 20, 10), color: "#9fb2c4" },
    { name: "ball", shape: makeSphere(5).translateZ(20), color: "#c7a98b" },
  ];
}`;

const parts = (await buildModel(SOURCE)).parts;

test("a STEP export carries the ISO header and both part names", async () => {
  const data = await exportParts(parts, "step");
  const text = new TextDecoder().decode(data);
  expect(text.startsWith("ISO-10303-21;")).toBe(true);
  expect(text).toContain("END-ISO-10303-21;");
  expect(text).toContain("block");
  expect(text).toContain("ball");
});

test("a binary STL export has a correct header and triangle count", async () => {
  const data = await exportParts(parts, "stl");
  expect(data.byteLength).toBeGreaterThan(84);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const triangles = view.getUint32(80, true);
  expect(triangles).toBeGreaterThan(11);
  expect(data.byteLength).toBe(84 + triangles * 50);
});

test("an export without a model is refused", async () => {
  await expect(exportParts([], "stl")).rejects.toThrow("no model");
});
