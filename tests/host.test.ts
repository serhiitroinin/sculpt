import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startKernel } from "./kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { ProjectStore } from "../src/main/projects.ts";
import { SculptHost, buildInput } from "../src/main/harness/host.ts";
import { OFFLINE_ENGINE } from "../src/main/harness/offline.ts";
import type { CadRequest, CadResponse } from "../src/shared/ipc.ts";

await startKernel();

const root = mkdtempSync(join(tmpdir(), "sculpt-test-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Stands in for the renderer: the real kernel, a placeholder for pixels. */
async function cad(request: CadRequest): Promise<CadResponse> {
  if (request.op === "build") {
    try {
      const built = await buildModel(request.source);
      return { op: "build", ok: true, report: built.report };
    } catch (error) {
      const failure = (error as { failure?: unknown }).failure;
      if (failure) return { op: "build", ok: false, failure: failure as never };
      throw error;
    }
  }
  if (request.op === "render") {
    return { op: "render", views: [{ label: "iso", data: "aGk=" }] };
  }
  throw new Error(`unexpected request: ${request.op}`);
}

function createHost(offlineRoot: string): { host: SculptHost; store: ProjectStore } {
  const store = new ProjectStore(join(offlineRoot, "projects"));
  const host = new SculptHost({
    appName: "Sculpt",
    appVersion: "0.0.0-test",
    workspace: join(offlineRoot, "workspace"),
    dataDir: offlineRoot,
    store,
    offline: true,
    cad,
    onRevision: () => undefined,
    activity: { start: () => "row", finish: () => undefined },
  });
  return { host, store };
}

test("the offline engine builds a revision through the real tool host", async () => {
  const directory = mkdtempSync(join(root, "run-"));
  const { host, store } = createHost(directory);
  const project = store.create("Bracket");
  const run = host.start(project.summary.id, { adapterId: OFFLINE_ENGINE }, {
    text: "A bracket please",
    pins: [],
    images: [],
  });
  const kinds: string[] = [];
  for await (const event of run.events) kinds.push(event.payload.kind);
  expect(await run.done).toBe("completed");
  expect(kinds).toContain("tool-completed");

  const state = store.state(project.summary.id);
  expect(state.currentRevision).toBe(1);
  expect(state.revisions[0]?.note).toContain("Offline bracket");
  expect(state.revisions[0]?.report.parts[0]?.name).toBe("bracket");
  expect(state.source).toContain("export function main");
  await host.close();
}, 120_000);

test("a pin becomes a context record and an ordered context reference", () => {
  const { parts, inlineContext } = buildInput({
    text: "round this edge",
    pins: [{ index: 1, point: [10, 0, 5], normal: [0, 0, 1], part: "plate", surface: "planar" }],
    camera: { position: [100, -100, 80], target: [0, 0, 0] },
    view: Buffer.from("png").toString("base64"),
    images: [],
  });
  expect(parts[0]).toEqual({ type: "text", text: "round this edge" });
  expect(parts[1]?.type).toBe("image");
  expect(parts[2]).toEqual({ type: "context-reference", contextId: "pin-1" });
  expect(inlineContext?.records[0]).toMatchObject({
    kind: "sculpt:pin",
    label: "Pin 1 on plate",
    payload: {
      point_mm: [10, 0, 5],
      part: "plate",
      surface: "planar",
      camera: { position: [100, -100, 80], target: [0, 0, 0] },
    },
  });
});

test("a turn without pins carries no inline context", () => {
  const { parts, inlineContext } = buildInput({ text: "hello", pins: [], images: [] });
  expect(parts).toHaveLength(1);
  expect(inlineContext).toBeUndefined();
});

test("reference images become image input parts", () => {
  const { parts } = buildInput({
    text: "like this",
    pins: [],
    images: [{ id: "abc", mediaType: "image/png", data: Buffer.from("x") }],
  });
  expect(parts[1]).toMatchObject({ type: "image", id: "reference-abc", mediaType: "image/png" });
});

test("a follow-up steers the running turn without starting a new one", async () => {
  const directory = mkdtempSync(join(root, "steer-"));
  const { host, store } = createHost(directory);
  const project = store.create("Steer");
  const run = host.start(project.summary.id, { adapterId: OFFLINE_ENGINE }, {
    text: "A bracket",
    pins: [],
    images: [],
  });

  const kinds: string[] = [];
  let text = "";
  let steered: string | undefined;
  for await (const event of run.events) {
    kinds.push(event.payload.kind);
    if (event.payload.kind === "assistant-text") text += event.payload.text;
    if (event.payload.kind === "tool-started" && steered === undefined) {
      steered = (await host.followUp("Make the foot 8 mm")).strategy;
    }
  }
  expect(await run.done).toBe("completed");
  expect(steered).toBe("same-turn");
  expect(kinds.filter((kind) => kind === "turn-started")).toHaveLength(1);
  expect(text).toContain("Noted while running: Make the foot 8 mm");
  await host.close();
}, 60_000);

test("cancelling a turn interrupts it and keeps the events already emitted", async () => {
  const directory = mkdtempSync(join(root, "stop-"));
  const { host, store } = createHost(directory);
  const project = store.create("Stop");
  const run = host.start(project.summary.id, { adapterId: OFFLINE_ENGINE }, {
    text: "A bracket",
    pins: [],
    images: [],
  });

  const kinds: string[] = [];
  for await (const event of run.events) {
    kinds.push(event.payload.kind);
    if (event.payload.kind === "assistant-text") void host.cancel();
  }
  expect(await run.done).toBe("interrupted");
  expect(kinds).toContain("assistant-text");

  const next = host.start(project.summary.id, { adapterId: OFFLINE_ENGINE }, {
    text: "Again",
    pins: [],
    images: [],
  });
  for await (const _event of next.events) { /* drain */ }
  expect(await next.done).toBe("completed");
  expect(store.state(project.summary.id).revisions.length).toBeGreaterThan(0);
  await host.close();
}, 60_000);
