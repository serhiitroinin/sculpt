import { rm } from "node:fs/promises";
import { $ } from "bun";
import { buildMainProcess } from "./build-main.ts";

const root = new URL("..", import.meta.url).pathname;

await rm(`${root}dist`, { recursive: true, force: true });
await buildMainProcess(root);
await $`bunx vite build`.cwd(root);
