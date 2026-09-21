export type DiffRow =
  | { kind: "same"; text: string; line: number }
  | { kind: "added"; text: string; line: number }
  | { kind: "removed"; text: string }
  | { kind: "gap"; count: number };

/** A plain LCS over lines: no dependency, and enough to read one revision. */
function commonTable(before: string[], after: string[]): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let a = before.length - 1; a >= 0; a -= 1) {
    for (let b = after.length - 1; b >= 0; b -= 1) {
      table[a]![b] = before[a] === after[b]
        ? table[a + 1]![b + 1]! + 1
        : Math.max(table[a + 1]![b]!, table[a]![b + 1]!);
    }
  }
  return table;
}

export function diffLines(before: string, after: string): DiffRow[] {
  const left = before === "" ? [] : before.split("\n");
  const right = after.split("\n");
  const table = commonTable(left, right);
  const rows: DiffRow[] = [];
  let a = 0;
  let b = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      rows.push({ kind: "same", text: right[b]!, line: b + 1 });
      a += 1;
      b += 1;
    } else if (table[a + 1]![b]! >= table[a]![b + 1]!) {
      rows.push({ kind: "removed", text: left[a]! });
      a += 1;
    } else {
      rows.push({ kind: "added", text: right[b]!, line: b + 1 });
      b += 1;
    }
  }
  while (a < left.length) rows.push({ kind: "removed", text: left[a++]! });
  while (b < right.length) rows.push({ kind: "added", text: right[b]!, line: (b += 1) });
  return rows;
}

const CONTEXT = 3;

/** Runs of more than six unchanged lines collapse to one gap row. */
export function collapseUnchanged(rows: DiffRow[], limit = 6): DiffRow[] {
  const output: DiffRow[] = [];
  let run: DiffRow[] = [];
  const flush = (): void => {
    if (run.length > limit) {
      output.push(...run.slice(0, CONTEXT));
      output.push({ kind: "gap", count: run.length - CONTEXT * 2 });
      output.push(...run.slice(-CONTEXT));
    } else {
      output.push(...run);
    }
    run = [];
  };
  for (const row of rows) {
    if (row.kind === "same") run.push(row);
    else {
      flush();
      output.push(row);
    }
  }
  flush();
  return output;
}

export function countChanges(rows: DiffRow[]): { added: number; removed: number } {
  return {
    added: rows.filter((row) => row.kind === "added").length,
    removed: rows.filter((row) => row.kind === "removed").length,
  };
}
