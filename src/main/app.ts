import { app, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessEvent } from "reins/protocol";
import type { CadResponse, MainEvent, StartTurn } from "../shared/ipc.ts";
import { EMPTY_TURN, reduceTurn } from "../shared/transcript.ts";
import type { EngineChoice, TranscriptEntry } from "../shared/project.ts";
import { CadBridge } from "./cad-bridge.ts";
import { ProjectStore } from "./projects.ts";
import { SculptHost } from "./harness/host.ts";
import { describeEngines } from "./harness/discovery.ts";

const entryId = (): string => randomUUID();

export class SculptApp {
  readonly cad = new CadBridge();
  private store: ProjectStore;
  private host: SculptHost;
  private openProject = "";
  private turnId = "";
  private started = new Map<string, number>();

  constructor(offline: boolean) {
    const dataDir = app.getPath("userData");
    this.store = new ProjectStore(join(dataDir, "projects"));
    this.host = new SculptHost({
      appName: "Sculpt",
      appVersion: app.getVersion(),
      workspace: join(dataDir, "workspace"),
      dataDir,
      store: this.store,
      offline,
      cad: (request) => this.cad.request(request),
      onRevision: () => this.publish(),
      activity: {
        start: (tool, text) => {
          const id = entryId();
          this.started.set(id, Date.now());
          this.record({
            kind: "activity",
            id,
            turnId: this.turnId,
            at: new Date().toISOString(),
            tool,
            text,
            status: "running",
          });
          return id;
        },
        finish: (id, patch) => {
          const started = this.started.get(id) ?? Date.now();
          this.started.delete(id);
          if (this.openProject === "") return;
          this.store.updateActivity(this.openProject, id, { ...patch, durationMs: Date.now() - started });
          this.publish();
        },
      },
    });
  }

  private publish(): void {
    if (this.openProject === "") return;
    this.cad.send({ kind: "project", project: this.store.state(this.openProject) });
  }

  private record(entry: TranscriptEntry): void {
    if (this.openProject === "") return;
    this.store.append(this.openProject, entry);
    this.publish();
  }

  register(): void {
    ipcMain.handle("sculpt:call", async (_event, method: string, payload: unknown) => {
      try {
        return await this.handle(method, payload);
      } catch (error) {
        process.stderr.write(`[sculpt] ${method} failed: ${error instanceof Error ? error.stack : String(error)}\n`);
        throw error;
      }
    });
  }

  private async handle(method: string, payload: unknown): Promise<unknown> {
    const value = (payload ?? {}) as Record<string, unknown>;
    switch (method) {
      case "engines.list":
        return describeEngines(this.host.runtime, this.host.engineIds);
      case "projects.list":
        return this.store.list();
      case "projects.create": {
        const state = this.store.create(String(value.name ?? "Untitled"));
        this.openProject = state.summary.id;
        return state;
      }
      case "projects.open": {
        this.openProject = String(value.id);
        return this.store.state(this.openProject);
      }
      case "projects.rename":
        return this.store.rename(String(value.id), String(value.name));
      case "projects.engine": {
        const { id, engine } = value as unknown as { id: string; engine: EngineChoice };
        this.store.setEngine(id, engine);
        return null;
      }
      case "images.add": {
        const image = value as unknown as {
          projectId: string; name: string; mediaType: string; data: string;
        };
        const added = this.store.addImage(image.projectId, image.name, image.mediaType, image.data);
        this.publish();
        return added;
      }
      case "images.remove": {
        const { projectId, imageId } = value as unknown as { projectId: string; imageId: string };
        this.store.removeImage(projectId, imageId);
        this.publish();
        return null;
      }
      case "images.read": {
        const { projectId, imageId } = value as unknown as { projectId: string; imageId: string };
        const image = this.store.imageBytes(projectId, imageId);
        return `data:${image.mediaType};base64,${image.data.toString("base64")}`;
      }
      case "assets.read": {
        const asset = value as unknown as {
          projectId: string; kind: "render" | "revision" | "image"; id: string;
        };
        const file = this.store.asset(asset.projectId, asset.kind, asset.id);
        return `data:${file.mediaType};base64,${file.data.toString("base64")}`;
      }
      case "revisions.source": {
        const { projectId, number } = value as unknown as { projectId: string; number: number };
        return this.store.source(projectId, number);
      }
      case "revisions.select": {
        const { projectId, number } = value as unknown as { projectId: string; number: number };
        const source = this.store.selectRevision(projectId, number);
        this.publish();
        return { source };
      }
      case "turn.start":
        return this.startTurn(value as unknown as StartTurn);
      case "turn.followUp":
        return this.host.followUp(String(value.text)).then(() => null);
      case "turn.cancel":
        return this.host.cancel().then(() => null);
      case "cad.result": {
        const result = value as unknown as { id: number; ok: boolean; value?: CadResponse; error?: string };
        this.cad.settle(result.id, result.ok, result.value, result.error);
        return null;
      }
      case "file.save":
        return this.saveFile(value as unknown as { name: string; data: string });
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  /** `SCULPT_EXPORT_DIR` writes without the dialog. It exists only for the checks. */
  private async saveFile(request: { name: string; data: string }): Promise<string | null> {
    const directory = process.env.SCULPT_EXPORT_DIR;
    if (directory) {
      const target = join(directory, request.name);
      await writeFile(target, Buffer.from(request.data, "base64"));
      return target;
    }
    const choice = await dialog.showSaveDialog({ defaultPath: request.name });
    if (choice.canceled || !choice.filePath) return null;
    await writeFile(choice.filePath, Buffer.from(request.data, "base64"));
    return choice.filePath;
  }

  /** Observable facts for the end-to-end checks. */
  readonly stats = { turns: 0, lastInputKinds: [] as string[], lastStatus: "" };

  private async startTurn(request: StartTurn): Promise<null> {
    this.openProject = request.projectId;
    this.store.setEngine(request.projectId, request.engine);
    this.turnId = entryId();
    const viewId = request.view ? this.store.saveRender(request.projectId, `view-${this.turnId}`, request.view) : undefined;
    this.record({
      kind: "user",
      id: entryId(),
      turnId: this.turnId,
      at: new Date().toISOString(),
      text: request.text,
      pins: request.pins,
      viewAttached: request.view !== undefined,
      ...(viewId ? { view: viewId } : {}),
      images: request.imageIds,
    });
    const images = request.imageIds.map((id) => {
      const bytes = this.store.imageBytes(request.projectId, id);
      this.store.markImageSeen(request.projectId, id);
      return { id, ...bytes };
    });
    this.stats.turns += 1;
    this.stats.lastInputKinds = [
      "text",
      ...images.map(() => "image"),
      ...(request.view ? ["image"] : []),
      ...request.pins.map(() => "context-reference"),
    ];
    const run = this.host.start(request.projectId, request.engine, {
      text: request.text,
      pins: request.pins,
      images,
      ...(request.camera ? { camera: request.camera } : {}),
      ...(request.view ? { view: request.view } : {}),
    });
    void this.drain(run.events, run.done, request.engine.adapterId, request.engine.model);
    return null;
  }

  private async drain(
    events: AsyncIterable<HarnessEvent>,
    done: Promise<string>,
    engine: string,
    model: string | undefined,
  ): Promise<void> {
    const turnId = this.turnId;
    const startedAt = Date.now();
    let turn = EMPTY_TURN;
    try {
      for await (const event of events) {
        if (process.env.SCULPT_DEBUG === "1") process.stderr.write(`[event] ${event.payload.kind}\n`);
        this.cad.send({ kind: "turn-event", payload: event.payload } satisfies MainEvent);
        turn = reduceTurn(turn, event.payload);
      }
      const status = await done;
      this.closeRunningRows(status);
      if (turn.text.trim() !== "") {
        this.record({
          kind: "agent",
          id: entryId(),
          turnId,
          at: new Date().toISOString(),
          text: turn.text.trim(),
          engine,
          durationMs: Date.now() - startedAt,
          status: status as "completed" | "error" | "interrupted",
          ...(model ? { model } : {}),
          ...(turn.thinkingMs > 0 ? { thinkingMs: turn.thinkingMs } : {}),
          ...(turn.usage ? { usage: turn.usage } : {}),
        });
      }
      this.stats.lastStatus = status;
      this.cad.send({ kind: "turn-ended", status });
    } catch (error) {
      this.closeRunningRows("error");
      this.cad.send({
        kind: "turn-ended",
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** A cancelled turn leaves a tool mid-flight; the row must not stay live. */
  private closeRunningRows(status: string): void {
    if (this.openProject === "") return;
    for (const [id, started] of this.started) {
      this.store.updateActivity(this.openProject, id, {
        status: "failed",
        text: status === "interrupted" ? "Stopped" : "Did not finish",
        durationMs: Date.now() - started,
      });
    }
    this.started.clear();
    this.publish();
  }

  close(): Promise<void> {
    return this.host.close();
  }
}
