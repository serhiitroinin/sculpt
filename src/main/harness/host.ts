import { createHarness, type HarnessRun, type HarnessRuntime } from "reins";
import { createFilePersistence } from "reins/persistence/file";
import type { HarnessInput, HarnessInlineContext } from "reins/protocol";
import type { ProjectStore } from "../projects.ts";
import type { CadRequest, CadResponse } from "../../shared/ipc.ts";
import type { EngineChoice, Pin } from "../../shared/project.ts";
import { createEngines } from "./engines.ts";
import { createOfflineEngine } from "./offline.ts";
import { guideSource, modelSource } from "./context.ts";
import { createModelingTools, type ActivityRecorder } from "./tools.ts";

export interface HostOptions {
  appName: string;
  appVersion: string;
  workspace: string;
  dataDir: string;
  store: ProjectStore;
  offline: boolean;
  cad(request: CadRequest): Promise<CadResponse>;
  onRevision(note: string): void;
  activity: ActivityRecorder;
}

const SYSTEM_PROMPT =
  "You are the modeling engine of a 3D modeling application. Use only the application tools.";

export interface TurnInput {
  text: string;
  pins: Pin[];
  camera?: { position: [number, number, number]; target: [number, number, number] };
  view?: string;
  images: { id: string; mediaType: string; data: Buffer }[];
}

export class SculptHost {
  readonly runtime: HarnessRuntime;
  readonly engineIds: string[];
  private active: HarnessRun | undefined;
  private projectId = "";

  constructor(private options: HostOptions) {
    const kit = {
      ...options,
      systemPrompt: SYSTEM_PROMPT,
      onStderr: (engine: string, text: string) => process.stderr.write(`[${engine}] ${text}`),
    };
    const engines = options.offline
      ? [createOfflineEngine(), ...createEngines(kit)]
      : createEngines(kit);
    this.engineIds = engines.map((engine) => engine.id);
    this.runtime = createHarness({
      adapters: engines,
      persistence: createFilePersistence({ directory: `${options.dataDir}/harness` }),
      tools: createModelingTools({
        projectId: () => this.projectId,
        cad: options.cad,
        store: options.store,
        onRevision: options.onRevision,
        activity: options.activity,
      }),
      contextSources: [guideSource(), modelSource(options.store, () => this.projectId)],
      onDiagnostic: (diagnostic) => {
        process.stderr.write(`[harness] ${JSON.stringify(diagnostic)}\n`);
      },
    });
  }

  private session(projectId: string): { tenantId: string; actorId: string; threadId: string } {
    return { tenantId: "sculpt", actorId: "local", threadId: projectId };
  }

  start(projectId: string, engine: EngineChoice, input: TurnInput): HarnessRun {
    if (this.active) throw new Error("a turn is already running");
    this.projectId = projectId;
    const { parts, inlineContext } = buildInput(input);
    const run = this.runtime.start({
      session: this.session(projectId),
      adapterId: engine.adapterId,
      input: parts,
      ...(inlineContext ? { inlineContext } : {}),
      ...(engine.model ? { model: engine.model } : {}),
      ...(engine.effort ? { effort: engine.effort } : {}),
      ...(engine.controls && Object.keys(engine.controls).length > 0
        ? { settings: { controls: engine.controls } }
        : {}),
    });
    this.active = run;
    void run.done.finally(() => {
      if (this.active === run) this.active = undefined;
    });
    return run;
  }

  followUp(text: string): Promise<{ strategy: string }> {
    const run = this.active;
    if (!run) throw new Error("no turn is running");
    return run.followUp({ expectedTurnId: run.turnId, input: [{ type: "text", text }] });
  }

  cancel(): Promise<void> {
    return this.active?.cancel() ?? Promise.resolve();
  }

  close(): Promise<void> {
    return this.runtime.close();
  }
}

export function buildInput(input: TurnInput): {
  parts: HarnessInput[];
  inlineContext: HarnessInlineContext | undefined;
} {
  const parts: HarnessInput[] = [{ type: "text", text: input.text }];
  const records: HarnessInlineContext["records"][number][] = [];

  for (const image of input.images) {
    parts.push({
      type: "image",
      id: `reference-${image.id}`,
      mediaType: image.mediaType,
      data: new Uint8Array(image.data),
      name: `reference ${image.id}`,
    });
  }

  if (input.view) {
    parts.push({
      type: "image",
      id: "current-view",
      mediaType: "image/png",
      data: new Uint8Array(Buffer.from(input.view, "base64")),
      name: "the user's current view",
    });
  }

  for (const pin of input.pins) {
    const id = `pin-${pin.index}`;
    records.push({
      version: 1,
      id,
      kind: "sculpt:pin",
      label: `Pin ${pin.index} on ${pin.part}`,
      payload: {
        index: pin.index,
        point_mm: [...pin.point],
        normal: [...pin.normal],
        part: pin.part,
        surface: pin.surface,
        ...(input.camera
          ? { camera: { position: [...input.camera.position], target: [...input.camera.target] } }
          : {}),
      },
    });
    parts.push({ type: "context-reference", contextId: id });
  }

  return {
    parts,
    inlineContext: records.length > 0 ? { version: 1, records } : undefined,
  };
}
