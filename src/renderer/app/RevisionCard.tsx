import { Asset } from "./Asset.tsx";
import type { Revision } from "../../shared/project.ts";
import { plural } from "../../shared/plural.ts";

interface Props {
  revision: Revision;
  projectId: string | undefined;
  current: boolean;
  onOpen(): void;
  onPreview(revision: number | undefined): void;
}

const mm = (value: number): string => `${Math.round(value * 10) / 10}`;

/** The thing people click to move between revisions. */
export function RevisionCard({ revision, projectId, current, onOpen, onPreview }: Props): React.JSX.Element {
  const size = revision.report.boundingBox.size.map(mm).join(" × ");
  return (
    <button
      className={current ? "revision-card current" : "revision-card"}
      onClick={onOpen}
      onMouseEnter={() => onPreview(revision.number)}
      onMouseLeave={() => onPreview(undefined)}
      title={revision.note}
    >
      <Asset
        projectId={projectId}
        kind="revision"
        id={revision.thumbnail ? String(revision.number) : undefined}
        alt={`revision ${revision.number}`}
        className="revision-thumb"
      />
      <span className="revision-body">
        <span className="revision-head mono">
          REV {String(revision.number).padStart(2, "0")}
          <span className="revision-size">{size} mm · {plural(revision.report.parts.length, "part")}</span>
        </span>
        <span className="revision-note">{revision.note}</span>
      </span>
    </button>
  );
}
