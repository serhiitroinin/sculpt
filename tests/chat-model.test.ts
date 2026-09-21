import { expect, test } from "bun:test";
import { collapseUnchanged, countChanges, diffLines } from "../src/shared/diff.ts";
import { parseInline, parseMarkdown } from "../src/shared/markdown.ts";
import { buildRowText, collapseSteps, formatDuration, formatElapsed, groupTurns, turnHeader } from "../src/shared/turns.ts";
import type { TranscriptEntry } from "../src/shared/project.ts";

test("the diff marks added and removed lines and keeps the rest", () => {
  const rows = diffLines("a\nb\nc", "a\nB\nc");
  expect(rows.map((row) => row.kind)).toEqual(["same", "removed", "added", "same"]);
  expect(countChanges(rows)).toEqual({ added: 1, removed: 1 });
});

test("a first revision is all additions", () => {
  expect(countChanges(diffLines("", "one\ntwo"))).toEqual({ added: 2, removed: 0 });
});

test("added lines carry their new line number", () => {
  const rows = diffLines("a", "a\nb\nc");
  expect(rows.filter((row) => row.kind === "added").map((row) => "line" in row && row.line)).toEqual([2, 3]);
});

test("a long unchanged run collapses to one gap", () => {
  const before = Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n");
  const after = `${before}\nextra`;
  const rows = collapseUnchanged(diffLines(before, after));
  const gap = rows.find((row) => row.kind === "gap");
  expect(gap).toEqual({ kind: "gap", count: 14 });
  expect(rows.filter((row) => row.kind === "same")).toHaveLength(6);
});

test("markdown renders unordered and ordered lists as lists, not as dashes", () => {
  const blocks = parseMarkdown("Parts:\n\n- a plate\n- two bosses\n\n1. first\n2. second");
  expect(blocks[0]).toEqual({ kind: "paragraph", content: [{ kind: "text", text: "Parts:" }] });
  expect(blocks[1]).toMatchObject({ kind: "list", ordered: false });
  expect(blocks[1]).toMatchObject({ items: [[{ kind: "text", text: "a plate" }], [{ kind: "text", text: "two bosses" }]] });
  expect(blocks[2]).toMatchObject({ kind: "list", ordered: true });
});

test("markdown renders a table, a heading and fenced code", () => {
  const blocks = parseMarkdown("## Sizes\n\n| part | mm |\n| --- | --- |\n| plate | 60 |\n\n```js\nmain();\n```");
  expect(blocks[0]).toMatchObject({ kind: "heading", level: 2 });
  expect(blocks[1]).toMatchObject({ kind: "table" });
  expect((blocks[1] as { rows: unknown[] }).rows).toHaveLength(1);
  expect(blocks[2]).toEqual({ kind: "code", language: "js", text: "main();" });
});

test("inline markup becomes bold, italic and code", () => {
  expect(parseInline("a **b** _c_ `d`")).toEqual([
    { kind: "text", text: "a " },
    { kind: "bold", text: "b" },
    { kind: "text", text: " " },
    { kind: "italic", text: "c" },
    { kind: "text", text: " " },
    { kind: "code", text: "d" },
  ]);
});

const step = (turnId: string, status: "running" | "done" | "failed", id = Math.random().toString()): TranscriptEntry => ({
  kind: "activity", id, turnId, at: "", tool: "set_model", text: "Building…", status,
});

test("a transcript groups into turns with the user message, the steps and the answer", () => {
  const turns = groupTurns([
    { kind: "user", id: "u1", turnId: "t1", at: "", text: "A bracket", pins: [], viewAttached: false, images: [] },
    step("t1", "done"),
    step("t1", "done"),
    { kind: "agent", id: "a1", turnId: "t1", at: "", text: "Done", durationMs: 23_000, status: "completed" },
    { kind: "user", id: "u2", turnId: "t2", at: "", text: "Again", pins: [], viewAttached: false, images: [] },
    step("t2", "running"),
  ]);
  expect(turns).toHaveLength(2);
  expect(turns[0]?.steps).toHaveLength(2);
  expect(turns[0]?.running).toBe(false);
  expect(turns[1]?.running).toBe(true);
});

test("the header reads live, then done, then stopped", () => {
  const [live] = groupTurns([step("t1", "running")]);
  expect(turnHeader(live!, 7000)).toBe("Working for 0:07");
  const [done] = groupTurns([
    step("t1", "done"),
    { kind: "agent", id: "a", turnId: "t1", at: "", text: "x", durationMs: 23_000, status: "completed" },
  ]);
  expect(turnHeader(done!, 0)).toBe("Worked for 23 s");
  const [stopped] = groupTurns([
    step("t1", "done"),
    { kind: "agent", id: "a", turnId: "t1", at: "", text: "x", durationMs: 12_000, status: "interrupted" },
  ]);
  expect(turnHeader(stopped!, 0)).toBe("Stopped after 12 s");
});

test("finished steps collapse but a live one never hides", () => {
  const finished = [step("t", "done"), step("t", "done"), step("t", "done"), step("t", "done")]
    .filter((entry): entry is Extract<TranscriptEntry, { kind: "activity" }> => entry.kind === "activity");
  expect(collapseSteps(finished)).toMatchObject({ hidden: 2 });
  const live = [...finished.slice(0, 3), { ...finished[0]!, status: "running" as const }];
  expect(collapseSteps(live).hidden).toBe(0);
});

test("durations read in the units a person expects", () => {
  expect(formatElapsed(7_000)).toBe("0:07");
  expect(formatElapsed(83_000)).toBe("1:23");
  expect(formatDuration(420)).toBe("420 ms");
  expect(formatDuration(6_400)).toBe("6.4 s");
  expect(formatDuration(23_000)).toBe("23 s");
  expect(formatDuration(95_000)).toBe("1 min 35 s");
});

test("a build row keeps its size apart from its label", () => {
  const box = { min: [0, 0, 0], max: [60, 40, 48.04], size: [60, 40, 48.04], center: [30, 20, 24] };
  const row = buildRowText({
    kind: "build",
    revision: 2,
    report: { boundingBox: box, parts: [{ name: "bracket" }] } as never,
    source: "",
    previousSource: "",
  });
  expect(row).toEqual({ label: "Built REV 02 · 1 part", size: "60 × 40 × 48 mm" });
});
