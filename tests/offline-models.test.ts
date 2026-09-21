import { expect, test } from "bun:test";
import { startKernel } from "./kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { offlineSources } from "../src/main/harness/offline-models.ts";

await startKernel();

for (const { name, source } of offlineSources()) {
  test(`the offline model "${name}" builds`, async () => {
    const built = await buildModel(source);
    expect(built.report.parts.length).toBeGreaterThan(0);
    for (const part of built.report.parts) expect(part.volume).toBeGreaterThan(0);
  });
}
