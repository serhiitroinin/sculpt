import { app, type BrowserWindow } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SculptApp } from "./app.ts";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const failures: string[] = [];
let checks = 0;

function check(name: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (condition) process.stdout.write(`  ok   ${name}\n`);
  else {
    failures.push(name);
    process.stdout.write(`  FAIL ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}`);
}

export class Driver {
  constructor(private window: BrowserWindow, private sculpt: SculptApp) {}

  run(script: string): Promise<unknown> {
    return this.window.webContents.executeJavaScript(`(() => { ${script} })()`);
  }

  text(selector: string): Promise<string> {
    return this.run(`return document.querySelector(${JSON.stringify(selector)})?.textContent ?? ""`) as Promise<string>;
  }

  count(selector: string): Promise<number> {
    return this.run(`return document.querySelectorAll(${JSON.stringify(selector)}).length`) as Promise<number>;
  }

  click(selector: string, index = 0): Promise<unknown> {
    return this.run(
      `document.querySelectorAll(${JSON.stringify(selector)})[${index}]?.click(); return true`,
    );
  }

  async type(prompt: string): Promise<void> {
    await this.run(`document.querySelector(".composer textarea").focus(); return true`);
    for (const character of prompt) {
      this.window.webContents.sendInputEvent({ type: "char", keyCode: character });
      await wait(4);
    }
    this.window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
    this.window.webContents.sendInputEvent({ type: "char", keyCode: "\r" });
    this.window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
  }

  clickViewport(x: number, y: number): void {
    for (const type of ["mouseDown", "mouseUp"] as const) {
      this.window.webContents.sendInputEvent({ type, x, y, button: "left", clickCount: 1 });
    }
  }

  async settled(timeoutMs = 40_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await wait(150);
      const running = await this.run(`return document.querySelector(".activity-line") !== null`);
      if (running === false) return;
    }
    throw new Error("a turn did not finish in time");
  }

  stats(): SculptApp["stats"] {
    return this.sculpt.stats;
  }
}

export function record(name: string, condition: boolean, detail = ""): void {
  check(name, condition, detail);
}

export function recordEqual(name: string, actual: unknown, expected: unknown): void {
  equal(name, actual, expected);
}

export function readFile(path: string): Buffer {
  return readFileSync(path);
}

/** `app.exit` sets the process status; `process.exit` does not in Electron. */
export function finish(): void {
  process.stdout.write(`\n${checks - failures.length}/${checks} checks passed\n`);
  if (failures.length > 0) process.stdout.write(`failed: ${failures.join(", ")}\n`);
  app.exit(failures.length > 0 ? 1 : 0);
}

export function exportDirectory(): string {
  return process.env.SCULPT_EXPORT_DIR ?? join(app.getPath("userData"), "exports");
}
