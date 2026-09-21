import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import * as replicad from "replicad";

let started: Promise<void> | undefined;

/** Streams the 23 MB kernel so the window can show real progress. */
async function fetchWasm(onProgress: (ratio: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(wasmUrl);
  const total = Number(response.headers.get("content-length") ?? 0);
  if (!response.body || total === 0) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.byteLength;
    onProgress(Math.min(read / total, 1));
  }
  const bytes = new Uint8Array(read);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export function startKernel(onProgress: (ratio: number) => void = () => undefined): Promise<void> {
  started ??= fetchWasm(onProgress)
    .then((binary) => opencascade({
      instantiateWasm: (imports: WebAssembly.Imports, ready: (instance: WebAssembly.Instance) => void) => {
        void WebAssembly.instantiate(binary, imports).then((result) => ready(result.instance));
        return {};
      },
    }))
    .then((oc) => {
      replicad.setOC(oc);
      onProgress(1);
    });
  return started;
}
