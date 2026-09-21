import { BrowserWindow, protocol, net } from "electron";
import { join } from "node:path";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DOCUMENT_CSP, WORKER_CSP } from "../shared/csp.ts";

export const APP_SCHEME = "sculpt";
const ORIGIN = `${APP_SCHEME}://app`;

export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  }]);
}

function mediaType(path: string): string | undefined {
  if (path.endsWith(".js")) return "text/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return undefined;
}

/** Serves the built renderer and gives the worker script its own policy. */
export function serveRenderer(rendererDir: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const relative = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = join(rendererDir, relative);
    if (!target.startsWith(rendererDir)) return new Response("Forbidden", { status: 403 });
    const response = await net.fetch(pathToFileURL(target).toString());
    const headers = new Headers(response.headers);
    const type = mediaType(target);
    if (type) headers.set("Content-Type", type);
    // The kernel progress bar needs a length to count against.
    const size = statSync(target, { throwIfNoEntry: false })?.size;
    if (size !== undefined && !headers.has("Content-Length")) headers.set("Content-Length", String(size));
    headers.set("Content-Security-Policy", relative.includes("cad-worker") ? WORKER_CSP : DOCUMENT_CSP);
    return new Response(response.body, { status: response.status, headers });
  });
}

export interface WindowOptions {
  preload: string;
  devServer?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  hidden?: boolean;
}

export function createWindow(options: WindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    ...(options.bounds ?? { width: 1440, height: 900 }),
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#15181c",
    titleBarStyle: "hiddenInset",
    show: false,
    webPreferences: {
      preload: options.preload,
      additionalArguments: process.env.SCULPT_DEBUG === "1" ? ["--sculpt-debug"] : [],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webgl: true,
      spellcheck: false,
      // A hidden window is throttled, and a scripted run has no visible window.
      backgroundThrottling: !options.hidden,
    },
  });
  if (!options.hidden) window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  const parameters = new URLSearchParams();
  if (process.env.SCULPT_THEME) parameters.set("theme", process.env.SCULPT_THEME);
  if (process.env.SCULPT_ENGINE) parameters.set("engine", process.env.SCULPT_ENGINE);
  if (process.env.SCULPT_MODEL) parameters.set("model", process.env.SCULPT_MODEL);
  const query = parameters.size === 0 ? "" : `?${parameters.toString()}`;
  void window.loadURL(`${options.devServer ?? `${ORIGIN}/index.html`}${query}`);
  return window;
}
