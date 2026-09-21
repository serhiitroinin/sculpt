import { contextBridge, ipcRenderer } from "electron";

const CALL = "sculpt:call";
const EVENT = "sculpt:event";

const bridge = {
  /** Set only when the main process was started with SCULPT_DEBUG=1. */
  debug: process.argv.includes("--sculpt-debug"),
  call(method: string, payload: unknown): Promise<unknown> {
    return ipcRenderer.invoke(CALL, method, payload);
  },
  subscribe(listener: (message: unknown) => void): () => void {
    const handler = (_event: unknown, message: unknown): void => listener(message);
    ipcRenderer.on(EVENT, handler);
    return () => ipcRenderer.off(EVENT, handler);
  },
};

contextBridge.exposeInMainWorld("sculpt", bridge);
