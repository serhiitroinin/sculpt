import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { buildMainProcess } from "./build-main.ts";

export const root = new URL("..", import.meta.url).pathname;

/** Builds the application unless `SCULPT_SKIP_BUILD=1`. */
export async function buildOnce(): Promise<void> {
  if (process.env.SCULPT_SKIP_BUILD === "1") return;
  await buildMainProcess(root);
  await $`bunx vite build`.cwd(root).quiet();
}

/** A new, empty user-data directory in the system temp directory. */
export function temporaryDataDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `sculpt-${label}-`));
}

export function removeDataDir(path: string): void {
  if (!path.startsWith(tmpdir())) throw new Error(`refusing to remove ${path}: it is not a temp directory`);
  rmSync(path, { recursive: true, force: true });
}

/**
 * Starts Electron with an exact environment and a temporary user-data
 * directory. A script never reads or writes the real application data.
 * `ELECTRON_RUN_AS_NODE` is not passed on, so Electron starts as an application.
 */
export function launchElectron(dataDir: string, env: Record<string, string>): number {
  const { PATH, HOME, USER, SHELL, TMPDIR, LANG } = process.env;
  const child = spawnSync("bunx", ["--bun", "electron", ".", "--user-data-dir", dataDir], {
    cwd: root,
    stdio: "inherit",
    env: { PATH, HOME, USER, SHELL, TMPDIR, LANG, ...env } as Record<string, string>,
  });
  return child.status ?? 1;
}
