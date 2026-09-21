import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startKernel } from "../tests/kernel.ts";
import { buildModel } from "../src/renderer/cad/build.ts";
import { ProjectStore } from "../src/main/projects.ts";
import { SculptHost } from "../src/main/harness/host.ts";
import { CLAUDE_ENGINE, CODEX_ENGINE } from "../src/main/harness/engines.ts";
import type { CadRequest, CadResponse } from "../src/shared/ipc.ts";

const [engineArgument, ...words] = process.argv.slice(2);
const engine = engineArgument === "codex" ? CODEX_ENGINE : CLAUDE_ENGINE;
const prompt = words.join(" ") || "A wall hook for a 30 mm rail, 4 mm thick, with two countersunk screw holes";

await startKernel();
const root = mkdtempSync(join(tmpdir(), "sculpt-live-"));
const store = new ProjectStore(join(root, "projects"));
const project = store.create("Live");

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
  if (request.op === "render") return { op: "render", views: [{ label: "iso", data: "" }] };
  throw new Error(`unexpected request: ${request.op}`);
}

const host = new SculptHost({
  appName: "Sculpt",
  appVersion: "0.1.0",
  workspace: join(root, "workspace"),
  dataDir: root,
  store,
  offline: false,
  cad,
  onRevision: (note) => console.log(`[revision] ${note}`),
  activity: {
    start: (tool, text) => { console.log(`[activity] ${tool}: ${text}`); return tool; },
    finish: (id, patch) => console.log(`[activity] ${id} -> ${patch.status}: ${patch.text}`),
  },
});

console.log(`engine ${engine}: ${JSON.stringify(await host.runtime.models(engine))}`.slice(0, 300));

const imagePath = process.env.SCULPT_SMOKE_IMAGE;
const images = imagePath
  ? [{
      id: store.addImage(project.summary.id, "reference.png", "image/png",
        Buffer.from(await Bun.file(imagePath).arrayBuffer()).toString("base64")).id,
      mediaType: "image/png",
      data: Buffer.from(await Bun.file(imagePath).arrayBuffer()),
    }]
  : [];

const run = host.start(project.summary.id, { adapterId: engine, ...(engine === CLAUDE_ENGINE ? { model: "sonnet" } : {}) }, {
  text: prompt,
  pins: [],
  images,
});

for await (const event of run.events) {
  const payload = event.payload;
  if (payload.kind === "assistant-text") process.stdout.write(payload.text);
  else if (payload.kind === "thinking") process.stdout.write(".");
  else console.log(`\n[${payload.kind}] ${JSON.stringify(payload).slice(0, 240)}`);
}
console.log(`\nstatus: ${await run.done}`);
console.log(`revisions: ${store.state(project.summary.id).revisions.length}`);
await host.close();
