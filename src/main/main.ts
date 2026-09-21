import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { createWindow, registerScheme, serveRenderer } from "./window.ts";
import { resolveLoginPath } from "./login-path.ts";
import { captureAndQuit } from "./capture.ts";
import { runChecks } from "./e2e-checks.ts";
import { SculptApp } from "./app.ts";

const root = app.getAppPath();
const dataDirFlag = process.argv.indexOf("--user-data-dir");
const dataDir = dataDirFlag > 0 ? process.argv[dataDirFlag + 1] : undefined;
if (dataDir) app.setPath("userData", dataDir);

// The scripted modes create and change projects. They never run on the real user data.
const scripted = process.env.SCULPT_CAPTURE !== undefined || process.env.SCULPT_E2E !== undefined;
if (scripted && !dataDir) {
  process.stderr.write("SCULPT_CAPTURE and SCULPT_E2E need --user-data-dir <temporary directory>.\n");
  process.exit(2);
}
const devServer = process.env.SCULPT_DEV_SERVER;

registerScheme();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function start(): Promise<void> {
  await app.whenReady();
  process.env.PATH = resolveLoginPath(process.env.PATH ?? "");
  if (!devServer) serveRenderer(join(root, "dist", "renderer"));

  const sculpt = new SculptApp(process.env.SCULPT_OFFLINE === "1");
  sculpt.register();
  app.on("before-quit", () => void sculpt.close());

  const capture = process.env.SCULPT_CAPTURE;
  const headless = scripted;
  const open = (): void => {
    const window = createWindow({
      preload: join(root, "dist", "main", "preload.cjs"),
      ...(devServer ? { devServer } : {}),
      ...(headless ? { bounds: { x: 40, y: 60, width: 1440, height: 900 }, hidden: true } : {}),
    });
    sculpt.cad.attach(window.webContents);
    window.webContents.on("console-message", (event) => {
      if (event.level === "error" || event.level === "warning") {
        process.stderr.write(`[renderer] ${event.message}\n`);
      }
    });
    if (capture) captureAndQuit(window, capture, Number(process.env.SCULPT_CAPTURE_DELAY ?? 6000));
    if (process.env.SCULPT_E2E) runChecks(window, sculpt);
  };
  open();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
}

void start();
