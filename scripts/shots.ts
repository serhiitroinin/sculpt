/**
 * Writes the README screenshots to docs/screenshots.
 *
 *   bun run shots            every offline plan, in the theme each plan names
 *   bun run shots hero       one plan
 *   bun run shots live       one real Claude Code turn per theme; uses your account
 *
 * Every run uses a new temporary user-data directory. Only the `live` plan
 * contacts a provider, and only when it is named.
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import type { CaptureStep } from "../src/main/capture.ts";
import { buildOnce, launchElectron, removeDataDir, root, temporaryDataDir } from "./launch.ts";

const out = join(root, "docs/screenshots");

const key = (value: string): CaptureStep => ({
  type: "js",
  script: `document.activeElement?.blur(); window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(value)} }))`,
});
/** Opens the last turn and shows every step of it. */
const openLastTurn: CaptureStep = {
  type: "js",
  script: `[...document.querySelectorAll(".work-header")].pop()?.click();
    setTimeout(() => document.querySelectorAll(".step-more").forEach((node) => node.click()), 250)`,
};
const openStep = (label: string, last = false): CaptureStep => ({
  type: "js",
  script: `const rows = [...document.querySelectorAll(".step")].filter((node) => node.textContent.includes(${JSON.stringify(label)}));
    const row = ${last} ? rows.pop() : rows[0];
    row?.querySelector(".step-line").click();
    setTimeout(() => row?.scrollIntoView({ block: "start" }), 500)`,
});

/** Names the open project. The next project event shows the name. */
const rename = (name: string): CaptureStep => ({
  type: "js",
  script: `window.sculpt.call("projects.list", null).then((list) =>
    window.sculpt.call("projects.rename", { id: list[0].id, name: ${JSON.stringify(name)} }))`,
});

const ENCLOSURE: CaptureStep[] = [
  { type: "ready" },
  rename("PCB enclosure"),
  { type: "prompt", text: "An enclosure for a 70 × 50 mm PCB with four M3 standoffs and a USB-C opening" },
  { type: "prompt", text: "Yes. Add a lid that locates inside the wall, with vent slots above the board" },
  { type: "prompt", text: "Round the outside edges and make the body 28 mm tall" },
];

const STAND: CaptureStep[] = [
  { type: "ready" },
  rename("Phone stand"),
  { type: "prompt", text: "A phone stand at 60°" },
  { type: "prompt", text: "Lean it back to 68° and add a slot for the charging cable" },
];

interface Plan {
  themes: ("light" | "dark")[];
  steps(theme: string): CaptureStep[];
  /** The engine of the plan. Without it, the offline engine. */
  engine?: { id: string; model: string };
}

/** A live turn takes minutes, not seconds. */
const live = (text: string): CaptureStep => ({ type: "prompt", text, timeoutMs: 900_000 });

const PLANS: Record<string, Plan> = {
  hero: {
    themes: ["light", "dark"],
    steps: (theme) => [
      ...ENCLOSURE,
      { type: "select", selector: ".view-control button" },
      key("d"),
      { type: "wait", ms: 1200 },
      { type: "shot", name: `hero-${theme}` },
    ],
  },
  steps: {
    themes: ["light"],
    steps: () => [
      ...ENCLOSURE.slice(0, 4),
      openLastTurn,
      { type: "wait", ms: 500 },
      { type: "wait", ms: 500 },
      openStep("Looked at", true),
      { type: "wait", ms: 1400 },
      { type: "shot", name: "turn-steps" },
      openStep("Looked at", true),
      { type: "wait", ms: 300 },
      openStep("Built REV", true),
      { type: "wait", ms: 1200 },
      { type: "shot", name: "build-diff" },
    ],
  },
  pins: {
    themes: ["light"],
    steps: () => [
      ...ENCLOSURE.slice(0, 4),
      { type: "click", x: 520, y: 470 },
      { type: "click", x: 700, y: 600 },
      { type: "js", script: `const area = document.querySelector(".composer textarea");
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        set.call(area, "Move the USB-C opening to the wall at pin 1, and add a 2 mm chamfer at pin 2");
        area.dispatchEvent(new Event("input", { bubbles: true }))` },
      { type: "wait", ms: 700 },
      { type: "shot", name: "pins" },
    ],
  },
  stand: {
    themes: ["light", "dark"],
    steps: (theme) => theme === "light"
      ? [
        ...STAND,
        key("d"),
        { type: "js", script: `document.querySelector('button[title^="Code drawer"]').click()` },
        { type: "wait", ms: 900 },
        { type: "shot", name: "code-drawer" },
      ]
      : [
        ...STAND,
        { type: "select", selector: 'button[title="Export"]' },
        { type: "shot", name: "export-dark" },
        { type: "select", selector: 'button[title="Export"]' },
        { type: "select", selector: ".picker .pill" },
        { type: "wait", ms: 500 },
        { type: "shot", name: "engine-picker-dark" },
      ],
  },
  live: {
    themes: ["dark", "light"],
    engine: { id: "kit:claude", model: "sonnet" },
    steps: (theme) => [
      { type: "ready" },
      rename("Wall hook"),
      live("A wall hook for a 30 mm rail, 4 mm thick, with two countersunk screw holes"),
      live("Round the outer edges and add a second hook 40 mm to the right"),
      { type: "select", selector: ".view-control button" },
      { type: "select", selector: ".view-control button", index: 4 },
      key("d"),
      { type: "wait", ms: 1200 },
      { type: "shot", name: `live-claude-${theme}` },
      ...(theme === "dark"
        ? [
          key("d"),
          openLastTurn,
          { type: "wait", ms: 1000 } as CaptureStep,
          openStep("Built REV", true),
          { type: "wait", ms: 1200 } as CaptureStep,
          { type: "shot", name: "live-claude-steps" } as CaptureStep,
        ]
        : []),
    ],
  },
};

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(PLANS).filter((name) => !PLANS[name]!.engine);
for (const name of names) if (!PLANS[name]) throw new Error(`unknown plan "${name}". Plans: ${Object.keys(PLANS).join(", ")}`);

await buildOnce();
mkdirSync(out, { recursive: true });
const raw = mkdtempSync(join(tmpdir(), "sculpt-shots-"));

let failed = false;
for (const name of names) {
  for (const theme of PLANS[name]!.themes) {
    const data = temporaryDataDir("shots");
    const engine = PLANS[name]!.engine;
    const status = launchElectron(data, {
      ...(engine
        ? { SCULPT_ENGINE: engine.id, SCULPT_MODEL: engine.model }
        : { SCULPT_OFFLINE: "1", SCULPT_ENGINE: "kit:offline", SCULPT_OFFLINE_STEP_MS: "350" }),
      SCULPT_CAPTURE: raw,
      SCULPT_CAPTURE_DELAY: "300",
      SCULPT_CAPTURE_PLAN: JSON.stringify(PLANS[name]!.steps(theme)),
      SCULPT_THEME: theme,
    });
    removeDataDir(data);
    if (status !== 0) failed = true;
  }
}

// The window is captured at 2x. The README needs 1440 px wide images.
for (const file of readdirSync(raw).filter((entry) => entry.endsWith(".png"))) {
  await $`sips --resampleWidth 1440 ${join(raw, file)} --out ${join(out, file)}`.quiet();
  console.log(`wrote docs/screenshots/${file}`);
}
rmSync(raw, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
