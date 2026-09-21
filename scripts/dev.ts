import { spawn } from "node:child_process";
import { createServer } from "vite";
import { buildMainProcess } from "./build-main.ts";

const root = new URL("..", import.meta.url).pathname;

await buildMainProcess(root);

const server = await createServer({ configFile: `${root}vite.config.ts` });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("the development server reported no local URL");

const electron = spawn("bunx", ["--bun", "electron", "."], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SCULPT_DEV_SERVER: url },
});

electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
