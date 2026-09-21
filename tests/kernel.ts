import opencascade from "replicad-opencascadejs";
import wasmPath from "replicad-opencascadejs/wasm" with { type: "file" };
import * as replicad from "replicad";

let started: Promise<void> | undefined;

/** Starts the same kernel the worker uses, without the Vite asset pipeline. */
export function startKernel(): Promise<void> {
  started ??= opencascade({ locateFile: () => wasmPath }).then((oc) => {
    replicad.setOC(oc);
    for (const [name, value] of Object.entries(replicad)) {
      (globalThis as unknown as Record<string, unknown>)[name] = value;
    }
    (globalThis as unknown as Record<string, unknown>).replicad = replicad;
  });
  return started;
}
