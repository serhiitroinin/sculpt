import { useState } from "react";
import { parseMarkdown, type Block, type Inline } from "../../shared/markdown.ts";
import { tokenize } from "./CodeDrawer.tsx";
import { Icon } from "./Icon.tsx";

function Spans({ content }: { content: Inline[] }): React.JSX.Element {
  return (
    <>
      {content.map((part, index) => {
        if (part.kind === "bold") return <strong key={index}>{part.text}</strong>;
        if (part.kind === "italic") return <em key={index}>{part.text}</em>;
        if (part.kind === "code") return <code key={index} className="mono">{part.text}</code>;
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

function Fence({ text, language }: { text: string; language: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fence">
      <header>
        <span className="mono">{language || "code"}</span>
        <button
          className="quiet"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={13} />
        </button>
      </header>
      <pre className="mono">
        {text.split("\n").map((line, index) => (
          <div key={index}>
            {tokenize(line).map((token, position) => (
              <span key={position} className={`t-${token.kind}`}>{token.text}</span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}

function One({ block }: { block: Block }): React.JSX.Element {
  if (block.kind === "heading") {
    const Tag = `h${Math.min(block.level + 2, 6)}` as "h3";
    return <Tag className="md-heading"><Spans content={block.content} /></Tag>;
  }
  if (block.kind === "list") {
    const items = block.items.map((item, index) => <li key={index}><Spans content={item} /></li>);
    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  if (block.kind === "code") return <Fence text={block.text} language={block.language} />;
  if (block.kind === "table") {
    return (
      <table className="md-table">
        <thead>
          <tr>{block.header.map((cell, index) => <th key={index}><Spans content={cell} /></th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}><Spans content={cell} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <p><Spans content={block.content} /></p>;
}

export function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="markdown">
      {parseMarkdown(text).map((block, index) => <One key={index} block={block} />)}
    </div>
  );
}
