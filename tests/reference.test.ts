import { expect, test } from "bun:test";
import { startKernel } from "./kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { referenceExamples } from "../src/shared/reference/index.ts";

await startKernel();

for (const example of referenceExamples()) {
  test(`reference ${example.topic} example ${example.index} builds`, async () => {
    const built = await buildModel(example.source);
    expect(built.report.parts.length).toBeGreaterThan(0);
    for (const part of built.report.parts) {
      expect(part.volume).toBeGreaterThan(0);
      expect(part.faceCount).toBeGreaterThan(0);
    }
  }, 60_000);
}
