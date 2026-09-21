import { execFileSync } from "node:child_process";

/**
 * Electron started from the Finder inherits a minimal PATH, so `claude` and
 * `codex` disappear. One login shell at startup restores the user's PATH.
 */
export function resolveLoginPath(current: string): string {
  if (process.platform === "win32") return current;
  const shell = process.env.SHELL ?? "/bin/zsh";
  try {
    const output = execFileSync(shell, ["-l", "-c", "printf %s \"$PATH\""], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (output === "") return current;
    const merged = [...new Set([...output.split(":"), ...current.split(":")])].filter(Boolean);
    return merged.join(":");
  } catch {
    return current;
  }
}
