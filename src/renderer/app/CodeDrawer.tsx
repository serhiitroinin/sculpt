const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "export", "import", "for", "of", "in", "if", "else",
  "new", "class", "await", "async", "from", "while", "break", "continue", "true", "false", "null",
]);

type Token = { text: string; kind: "keyword" | "number" | "string" | "comment" | "plain" };

/** Four token classes are enough to read a model script, and cost no dependency. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;
  let match: RegExpExecArray | null = pattern.exec(line);
  while (match !== null) {
    const [whole, comment, string, digits, word] = match;
    if (comment) tokens.push({ text: whole, kind: "comment" });
    else if (string) tokens.push({ text: whole, kind: "string" });
    else if (digits) tokens.push({ text: whole, kind: "number" });
    else if (word) tokens.push({ text: whole, kind: KEYWORDS.has(word) ? "keyword" : "plain" });
    else tokens.push({ text: whole, kind: "plain" });
    match = pattern.exec(line);
  }
  return tokens;
}

interface Props {
  source: string;
  title: string;
  onClose(): void;
}

export function CodeDrawer({ source, title, onClose }: Props): React.JSX.Element {
  const lines = source.split("\n");
  return (
    <aside className="drawer">
      <header>
        <span className="label">{title}</span>
        <button className="quiet" onClick={onClose}>Close <kbd>⌘J</kbd></button>
      </header>
      <div className="code mono">
        {lines.map((line, index) => (
          <div className="code-line" key={index}>
            <span className="gutter">{index + 1}</span>
            <span className="code-text">
              {tokenize(line).map((token, position) => (
                <span key={position} className={`t-${token.kind}`}>{token.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
