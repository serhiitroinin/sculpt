import { expect, test } from "bun:test";
import type { EngineChoice } from "../src/shared/project.ts";
import { limitPercent, limitResets, limitValue, resolveEngine, withModel } from "../src/shared/engines.ts";

const available = [
  { id: "kit:claude", defaultModelId: "sonnet" },
  { id: "kit:codex", defaultModelId: "gpt-6-astra" },
];

test("a remembered engine that exists is used with its remembered model", () => {
  expect(resolveEngine({ adapterId: "kit:codex", model: "gpt-6" }, available))
    .toEqual({ adapterId: "kit:codex", model: "gpt-6", fellBack: false });
});

test("a remembered engine with no model takes the engine default", () => {
  expect(resolveEngine({ adapterId: "kit:codex" }, available))
    .toEqual({ adapterId: "kit:codex", model: "gpt-6-astra", fellBack: false });
});

test("an engine that is not available falls back to the first one and says so", () => {
  expect(resolveEngine({ adapterId: "kit:offline", model: "fixture" }, available))
    .toEqual({ adapterId: "kit:claude", model: "sonnet", fellBack: true });
});

test("no remembered choice is not a fallback", () => {
  expect(resolveEngine(undefined, available)).toEqual({ adapterId: "kit:claude", model: "sonnet", fellBack: false });
});

test("with no engines at all there is nothing to select", () => {
  expect(resolveEngine({ adapterId: "kit:claude" }, [])).toBeUndefined();
});

test("a model switch drops an effort the new model does not take", () => {
  const choice: EngineChoice = { adapterId: "kit:claude", model: "default", effort: "xhigh", controls: { speed: "fast" } };
  expect(withModel(choice, "kit:claude", { id: "opus", efforts: [{ id: "low" }, { id: "xhigh" }] }))
    .toEqual({ adapterId: "kit:claude", model: "opus", effort: "xhigh", controls: { speed: "fast" } });
  expect(withModel(choice, "kit:claude", { id: "sonnet", efforts: [{ id: "low" }] }))
    .toEqual({ adapterId: "kit:claude", model: "sonnet", controls: { speed: "fast" } });
  expect(withModel(choice, "kit:claude", { id: "haiku" }))
    .toEqual({ adapterId: "kit:claude", model: "haiku", controls: { speed: "fast" } });
});

test("a limit row shows a value and a reset time", () => {
  const now = Date.parse("2026-09-20T10:00:00Z");
  const weekly = { label: "Weekly", unit: "%", usedPercent: 68.4, resetsAt: "2026-09-24T10:00:00Z" };
  expect(limitValue(weekly)).toBe("68%");
  expect(limitValue({ label: "Credits", unit: "credits", remaining: 40 })).toBe("40 credits left");
  expect(limitResets(weekly, now)).toBe("resets in 4 d");
  expect(limitResets({ ...weekly, resetsAt: "2026-09-20T13:00:00Z" }, now)).toBe("resets in 3 h");
  expect(limitPercent({ label: "x", unit: "req", used: 5, limit: 20 })).toBe(25);
});
