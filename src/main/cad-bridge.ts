import type { WebContents } from "electron";
import type { CadRequest, CadResponse, MainEvent } from "../shared/ipc.ts";

const TIMEOUT_MS = 45_000;

interface Waiting {
  resolve(value: CadResponse): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * The CAD kernel and the viewport live in the renderer, so a modeling tool
 * that runs in the main process asks the window to do the work.
 */
export class CadBridge {
  private waiting = new Map<number, Waiting>();
  private nextId = 1;
  private contents: WebContents | undefined;

  attach(contents: WebContents): void {
    this.contents = contents;
  }

  send(message: MainEvent): void {
    this.contents?.send("sculpt:event", message);
  }

  request(request: CadRequest): Promise<CadResponse> {
    const contents = this.contents;
    if (!contents) return Promise.reject(new Error("no window is open"));
    const id = this.nextId++;
    return new Promise<CadResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`the viewport did not answer the ${request.op} request`));
      }, TIMEOUT_MS);
      this.waiting.set(id, { resolve, reject, timer });
      contents.send("sculpt:event", { kind: "cad-request", id, request } satisfies MainEvent);
    });
  }

  settle(id: number, ok: boolean, value?: CadResponse, error?: string): void {
    const waiting = this.waiting.get(id);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    this.waiting.delete(id);
    if (ok && value) waiting.resolve(value);
    else waiting.reject(new Error(error ?? "the viewport reported a failure"));
  }
}
