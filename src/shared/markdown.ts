export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string };

export type Block =
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; language: string; text: string }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] };

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

export function parseInline(text: string): Inline[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part): Inline => {
      if (part.startsWith("**") && part.endsWith("**")) return { kind: "bold", text: part.slice(2, -2) };
      if (part.startsWith("`") && part.endsWith("`")) return { kind: "code", text: part.slice(1, -1) };
      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return { kind: "italic", text: part.slice(1, -1) };
      }
      return { kind: "text", text: part };
    });
}

function tableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

const isSeparator = (line: string): boolean => /^\|?[\s:-]*-[\s|:-]*\|?$/.test(line) && line.includes("-");

/**
 * Enough Markdown for an agent's answer: paragraphs, headings, lists, tables
 * and fenced code. No dependency, and the rules are asserted by tests.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;

    if (line.startsWith("```")) {
      flush();
      const language = line.slice(3).trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.startsWith("```")) body.push(lines[index++]!);
      blocks.push({ kind: "code", language, text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1]!.length, content: parseInline(heading[2]!) });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = numbered !== null;
      const items: Inline[][] = [];
      while (index < lines.length) {
        const item = ordered
          ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[index]!)
          : /^\s*[-*+]\s+(.*)$/.exec(lines[index]!);
        if (!item) break;
        items.push(parseInline(item[1]!));
        index += 1;
      }
      index -= 1;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    if (line.includes("|") && isSeparator(lines[index + 1] ?? "")) {
      flush();
      const header = tableRow(line).map(parseInline);
      index += 2;
      const rows: Inline[][][] = [];
      while (index < lines.length && lines[index]!.includes("|")) {
        rows.push(tableRow(lines[index++]!).map(parseInline));
      }
      index -= 1;
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    if (line.trim() === "") flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
