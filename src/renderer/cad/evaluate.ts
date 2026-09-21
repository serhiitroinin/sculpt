import type { BuildFailure } from "../../shared/cad.ts";
import { describeKernelError } from "./kernel-error.ts";

export interface ModelPart {
  name: string;
  shape: unknown;
  color?: string;
}

export class BuildError extends Error {
  constructor(readonly failure: BuildFailure) {
    super(failure.message);
    this.name = "BuildError";
  }
}

/** Best effort: a runtime without stack traces returns no position. */
export function locate(error: Error, blobUrl: string, source: string): Partial<BuildFailure> {
  const stack = error.stack ?? "";
  const escaped = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}:(\\d+):(\\d+)`).exec(stack);
  if (!match) return {};
  const line = Number(match[1]);
  const column = Number(match[2]);
  const sourceLine = source.split("\n")[line - 1];
  return { line, column, ...(sourceLine === undefined ? {} : { sourceLine }) };
}

function asParts(value: unknown): ModelPart[] {
  if (!Array.isArray(value)) {
    throw new BuildError({
      phase: "run",
      message: "main() must return an array of parts: [{ name, shape, color }].",
    });
  }
  return value.map((entry, index) => {
    const part = entry as Partial<ModelPart> | null;
    if (!part || typeof part !== "object" || !("shape" in part) || !part.shape) {
      throw new BuildError({
        phase: "run",
        message: `Part ${index} has no shape. Every entry needs { name, shape } and may add color.`,
      });
    }
    const name = typeof part.name === "string" && part.name.trim() !== ""
      ? part.name.trim()
      : `part${index + 1}`;
    return { name, shape: part.shape, ...(part.color ? { color: part.color } : {}) };
  });
}

/**
 * Agent-written code runs as a real ES module from a blob URL. This keeps
 * `unsafe-eval` out of the worker policy and keeps stack line numbers aligned
 * with the source the agent wrote.
 */
export async function evaluateModel(source: string): Promise<ModelPart[]> {
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    let module: Record<string, unknown>;
    try {
      module = (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>;
    } catch (error) {
      const failed = error as Error;
      throw new BuildError({
        phase: "compile",
        message: failed.message,
        ...locate(failed, blobUrl, source),
      });
    }
    const main = module.main ?? module.default;
    if (typeof main !== "function") {
      throw new BuildError({
        phase: "run",
        message: "The script must export a function named main: `export function main() { ... }`."
          + " This is an ES module: module.exports, exports and require do not exist.",
      });
    }
    try {
      return asParts(await (main as () => unknown)());
    } catch (error) {
      if (error instanceof BuildError) throw error;
      const kernel = describeKernelError(error);
      const failed = error instanceof Error ? error : new Error(String(error));
      throw new BuildError({
        phase: kernel !== undefined || !(error instanceof Error) ? "kernel" : "run",
        message: kernel ?? (failed.message === "" ? String(error) : failed.message),
        ...locate(failed, blobUrl, source),
      });
    }
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
