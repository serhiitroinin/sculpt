import { app, type BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export type CaptureStep =
  /** Waits until the kernel is ready, the empty project shows, and an engine is chosen. */
  | { type: "ready" }
  /**
   * Types a message, sends it, and waits until the turn ends. `turnMs` stops
   * the wait early. `timeoutMs` extends the wait for a live engine.
   */
  | { type: "prompt"; text: string; turnMs?: number; timeoutMs?: number }
  | { type: "click"; x: number; y: number }
  | { type: "select"; selector: string; index?: number }
  | { type: "js"; script: string }
  | { type: "wait"; ms: number }
  | { type: "shot"; name: string };

/**
 * Development aid. `SCULPT_CAPTURE` names an output directory. The plan in
 * `SCULPT_CAPTURE_PLAN` runs in a hidden window and writes screenshots there.
 * `scripts/shots.ts` is the caller.
 */
export function captureAndQuit(window: BrowserWindow, directory: string, delayMs: number): void {
  window.webContents.once("did-finish-load", () => {
    void (async () => {
      window.setContentSize(1440, 900);
      await wait(delayMs);
      const plan = process.env.SCULPT_CAPTURE_PLAN;
      try {
        if (plan) await runPlan(window, JSON.parse(plan) as CaptureStep[], directory);
        else await shoot(window, join(directory, "window.png"));
        app.exit(0);
      } catch (error) {
        process.stderr.write(`[capture] ${error instanceof Error ? error.message : String(error)}\n`);
        app.exit(1);
      }
    })();
  });
}

async function shoot(window: BrowserWindow, target: string): Promise<void> {
  const image = await window.webContents.capturePage();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, image.toPNG());
  process.stderr.write(`[capture] wrote ${target}\n`);
}

async function type(window: BrowserWindow, text: string): Promise<void> {
  await window.webContents.executeJavaScript(`document.querySelector(".composer textarea").focus(); return true`
    .replace("return true", "true"));
  for (const character of text) {
    window.webContents.sendInputEvent({ type: "char", keyCode: character });
    await wait(6);
  }
  window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
  window.webContents.sendInputEvent({ type: "char", keyCode: "\r" });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
}

async function until(window: BrowserWindow, expression: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await window.webContents.executeJavaScript(expression) === true) return;
    await wait(150);
  }
  throw new Error(`the capture plan waited too long for: ${expression}`);
}

async function runPlan(window: BrowserWindow, steps: CaptureStep[], directory: string): Promise<void> {
  for (const step of steps) {
    if (step.type === "ready") {
      await until(window, `document.querySelector(".empty") !== null`, 120_000);
      // A message needs an engine, and the engines answer in their own time.
      await until(window, `!["", "no engine"].includes(document.querySelector(".pill-model")?.textContent ?? "")`, 60_000);
      await wait(400);
    } else if (step.type === "prompt") {
      await type(window, step.text);
      if (step.turnMs !== undefined) await wait(step.turnMs);
      else {
        await until(window, `document.querySelector(".activity-line") !== null`, 10_000);
        await until(window, `document.querySelector(".activity-line") === null`, step.timeoutMs ?? 120_000);
        await wait(1200);
      }
    } else if (step.type === "click") {
      for (const kind of ["mouseDown", "mouseUp"] as const) {
        window.webContents.sendInputEvent({ type: kind, x: step.x, y: step.y, button: "left", clickCount: 1 });
      }
      await wait(700);
    } else if (step.type === "select") {
      await window.webContents.executeJavaScript(
        `document.querySelectorAll(${JSON.stringify(step.selector)})[${step.index ?? 0}]?.click(), true`,
      );
      await wait(600);
    } else if (step.type === "js") {
      await window.webContents.executeJavaScript(`(() => { ${step.script} })()`);
      await wait(400);
    } else if (step.type === "wait") {
      await wait(step.ms);
    } else {
      await shoot(window, join(directory, `${step.name}.png`));
    }
  }
}
