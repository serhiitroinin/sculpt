import { Asset } from "./Asset.tsx";
import { collapseUnchanged, countChanges, diffLines } from "../../shared/diff.ts";
import type { ActivityDetail as Detail } from "../../shared/project.ts";

const mm = (value: number): string => `${Math.round(value * 10) / 10}`;

function Report({ detail }: { detail: Extract<Detail, { kind: "build" }> }): React.JSX.Element {
  const rows = collapseUnchanged(diffLines(detail.previousSource, detail.source));
  const changes = countChanges(rows);
  return (
    <>
      <table className="report mono">
        <thead>
          <tr><th className="report-name">part</th><th>size mm</th><th>cm³</th><th>faces</th></tr>
        </thead>
        <tbody>
          {detail.report.parts.map((part) => (
            <tr key={part.name}>
              <td className="report-name">{part.name}</td>
              <td>{part.boundingBox.size.map(mm).join(" × ")}</td>
              <td>{mm(part.volume / 1000)}</td>
              <td>{part.faceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="detail-label">
        Script diff · <span className="added">+{changes.added}</span> <span className="removed">−{changes.removed}</span>
      </p>
      <div className="diff mono">
        {rows.map((row, index) => {
          if (row.kind === "gap") return <div key={index} className="diff-gap">⋯ {row.count} unchanged</div>;
          return (
            <div key={index} className={`diff-row ${row.kind}`}>
              <span className="diff-sign">{row.kind === "added" ? "+" : row.kind === "removed" ? "−" : " "}</span>
              <span className="diff-text">{row.text || " "}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

interface Props {
  detail: Detail;
  projectId: string | undefined;
  onZoom(url: string): void;
}

export function ActivityDetail({ detail, projectId, onZoom }: Props): React.JSX.Element {
  if (detail.kind === "build") return <Report detail={detail} />;
  if (detail.kind === "build-failed") {
    return (
      <>
        <pre className="failure mono">{detail.message}</pre>
        {detail.sourceLines.length > 0
          ? (
            <div className="source mono">
              {detail.sourceLines.map((line) => {
                const number = Number(line.split("│")[0]);
                return (
                  <div key={line} className={number === detail.line ? "source-line marked" : "source-line"}>
                    {line}
                  </div>
                );
              })}
            </div>
          )
          : null}
      </>
    );
  }
  if (detail.kind === "views") {
    return (
      <div className="render-tiles">
        {detail.renders.map((render) => (
          <Asset key={render} projectId={projectId} kind="render" id={render} alt="what the agent saw" onClick={onZoom} />
        ))}
      </div>
    );
  }
  if (detail.kind === "image") {
    return (
      <div className="render-tiles">
        <Asset projectId={projectId} kind="image" id={detail.imageId} alt="reference image" onClick={onZoom} />
      </div>
    );
  }
  return (
    <>
      <p className="detail-label">{detail.title}</p>
      <pre className="facts mono">{detail.body}</pre>
    </>
  );
}
