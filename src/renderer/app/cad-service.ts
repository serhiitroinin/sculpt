import type { CadRequest, CadResponse } from "../../shared/ipc.ts";
import type { Pin } from "../../shared/project.ts";
import { session } from "../session.ts";

export interface CadServiceHooks {
  pins(): Pin[];
  onBuilt(): void;
  onFailed(message: string): void;
}

function viewport() {
  const value = session.viewport;
  if (!value) throw new Error("the viewport is not ready");
  return value;
}

/** Answers the modeling work the main process asks the window to perform. */
export async function serveCadRequest(request: CadRequest, hooks: CadServiceHooks): Promise<CadResponse> {
  if (request.op === "build" || request.op === "restore") {
    viewport().setRebuilding(true);
    const result = await session.client.build(request.source);
    viewport().setRebuilding(false);
    if (!result.ok) {
      if (request.op === "restore") return { op: "restore", ok: false };
      hooks.onFailed(result.failure.message);
      return { op: "build", ok: false, failure: result.failure };
    }
    const keepCamera = session.report !== undefined;
    viewport().setModel(result.meshes, keepCamera);
    session.report = result.report;
    hooks.onBuilt();
    return request.op === "restore"
      ? { op: "restore", ok: true }
      : { op: "build", ok: true, report: result.report };
  }
  if (request.op === "render") {
    return {
      op: "render",
      views: viewport().renderViews(request.request.views, request.request.size, request.request.plain === true),
    };
  }
  if (request.op === "measure") {
    return { op: "measure", result: await session.client.measure(request.request) };
  }
  return { op: "pins", pins: hooks.pins() };
}
