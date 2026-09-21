/** The harness ships ESM-only export conditions, so it is bundled into the CJS main. */
const EXTERNAL = ["electron", "@anthropic-ai/claude-agent-sdk"];

export async function buildMainProcess(root: string): Promise<void> {
  const main = await Bun.build({
    entrypoints: [`${root}src/main/main.ts`],
    outdir: `${root}dist/main`,
    target: "node",
    format: "cjs",
    naming: "[dir]/[name].cjs",
    external: EXTERNAL,
  });
  if (!main.success) throw new AggregateError(main.logs, "main bundle failed");

  const preload = await Bun.build({
    entrypoints: [`${root}src/main/preload.ts`],
    outdir: `${root}dist/main`,
    target: "node",
    format: "cjs",
    naming: "[dir]/[name].cjs",
    external: ["electron"],
  });
  if (!preload.success) throw new AggregateError(preload.logs, "preload bundle failed");
}
