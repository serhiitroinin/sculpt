import type {
  BuildResult,
  ExportFormat,
  MeasureRequest,
  MeasureResult,
  WorkerRequest,
  WorkerResponse,
} from "../../shared/cad.ts";

const BUILD_TIMEOUT_MS = 20_000;
const CALL_TIMEOUT_MS = 30_000;

type WorkerCall = WorkerRequest extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;

interface Pending {
  resolve(response: WorkerResponse): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

function spawnWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "sculpt-cad" });
}

/**
 * Owns the one worker that runs agent-written scripts. A script that does not
 * finish inside the wall-clock limit kills the worker; the next call gets a
 * fresh one and the caller sees a timeout failure.
 */
export class CadClient {
  private worker: Worker | undefined;
  onKernel: ((state: { ratio: number; ready: boolean }) => void) | undefined;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private lastGoodSource: string | undefined;

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = spawnWorker();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.kind === "progress") {
        this.onKernel?.({ ratio: message.ratio, ready: false });
        return;
      }
      if (message.kind === "ready") {
        this.onKernel?.({ ratio: 1, ready: true });
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.kind === "failed") pending.reject(new Error(message.message));
      else pending.resolve(message);
    };
    worker.onerror = (event) => this.crash(event.message || "The modeling worker stopped.");
    this.worker = worker;
    return worker;
  }

  /** Starts the worker, and with it the kernel download, before the first build asks for it. */
  warm(): void {
    this.ensure();
  }

  private crash(message: string): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private send(request: WorkerCall, timeoutMs: number): Promise<WorkerResponse> {
    const id = this.nextId++;
    const worker = this.ensure();
    return new Promise<WorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.crash(`The kernel did not answer within ${Math.round(timeoutMs / 1000)} seconds.`);
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ ...request, id } as WorkerRequest);
    });
  }

  async build(source: string): Promise<BuildResult> {
    let response: WorkerResponse;
    try {
      response = await this.send({ kind: "build", source }, BUILD_TIMEOUT_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.lastGoodSource !== undefined) void this.replayLastGood();
      return { ok: false, failure: { phase: "timeout", message } };
    }
    if (response.kind !== "build") throw new Error("the worker answered a build with another message");
    if (response.result.ok) this.lastGoodSource = source;
    return response.result;
  }

  private async replayLastGood(): Promise<void> {
    const source = this.lastGoodSource;
    if (source === undefined) return;
    await this.send({ kind: "build", source }, BUILD_TIMEOUT_MS).catch(() => undefined);
  }

  async measure(request: MeasureRequest): Promise<MeasureResult> {
    const response = await this.send({ kind: "measure", request }, CALL_TIMEOUT_MS);
    if (response.kind !== "measure") throw new Error("the worker answered a measurement with another message");
    return response.result;
  }

  async export(format: ExportFormat): Promise<Uint8Array> {
    const response = await this.send({ kind: "export", format }, CALL_TIMEOUT_MS);
    if (response.kind !== "export") throw new Error("the worker answered an export with another message");
    return response.data;
  }
}
