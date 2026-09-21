import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildOnce, launchElectron, removeDataDir, temporaryDataDir } from "./launch.ts";

const data = temporaryDataDir("e2e");
const exports = join(data, "exports");
mkdirSync(exports, { recursive: true });

await buildOnce();

function launch(phase: string): number {
  return launchElectron(data, {
    SCULPT_OFFLINE: "1",
    SCULPT_E2E: phase,
    SCULPT_EXPORT_DIR: exports,
    SCULPT_OFFLINE_STEP_MS: "400",
    SCULPT_THEME: "dark",
  });
}

const first = launch("first");
const second = first === 0 ? launch("restart") : 1;
if (process.env.SCULPT_E2E_KEEP === "1") console.log(`kept ${data}`);
else removeDataDir(data);
process.exit(first === 0 && second === 0 ? 0 : 1);
