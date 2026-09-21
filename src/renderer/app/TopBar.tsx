import { useState } from "react";
import { Icon } from "./Icon.tsx";
import { Rolling } from "./Rolling.tsx";
import type { ProjectState, ProjectSummary } from "../../shared/project.ts";
import { plural } from "../../shared/plural.ts";

interface Props {
  project: ProjectState | undefined;
  projects: ProjectSummary[];
  theme: "dark" | "light";
  themeMode: "system" | "light" | "dark";
  railOpen: boolean;
  onOpen(id: string): void;
  onCreate(): void;
  onSelectRevision(revision: number): void;
  onExport(format: "step" | "stl"): void;
  exporting: "idle" | "working" | "done";
  onToggleCode(): void;
  onThemeMode(mode: "system" | "light" | "dark"): void;
  onToggleRail(): void;
}

const size = (values: [number, number, number]): string =>
  values.map((value) => Math.round(value * 10) / 10).join(" × ");

export function TopBar(props: Props): React.JSX.Element {
  const [projectMenu, setProjectMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [revisionMenu, setRevisionMenu] = useState(false);
  const [themeMenu, setThemeMenu] = useState(false);
  const revisions = props.project?.revisions ?? [];
  const current = props.project?.currentRevision;
  const index = revisions.findIndex((revision) => revision.number === current);
  const active = index >= 0 ? revisions[index] : undefined;
  const report = active?.report;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="quiet" title="Toggle the rail (⌘B)" onClick={props.onToggleRail}>
          <Icon name="panel-left" />
        </button>
        <button className="project" onClick={() => setProjectMenu(!projectMenu)}>
          {props.project?.summary.name ?? "Sculpt"}
          <Icon name="chevron-down" size={13} />
        </button>
        {projectMenu
          ? (
            <div className="menu" onMouseLeave={() => setProjectMenu(false)}>
              <p className="menu-label">Projects</p>
              {props.projects.map((summary) => (
                <button
                  key={summary.id}
                  className="menu-item"
                  onClick={() => { setProjectMenu(false); props.onOpen(summary.id); }}
                >
                  {summary.name}
                </button>
              ))}
              <div className="menu-rule" />
              <button className="menu-item" onClick={() => { setProjectMenu(false); props.onCreate(); }}>
                <Icon name="plus" size={13} />
                New project
              </button>
            </div>
          )
          : null}
      </div>

      <div className="title-block">
        <div className="cell rev">
          <button
            disabled={index <= 0}
            title="Previous revision"
            onClick={() => props.onSelectRevision(revisions[index - 1]!.number)}
          >
            <Icon name="chevron-left" size={13} />
          </button>
          <button
            className="mono rev-label"
            title={active?.note}
            disabled={revisions.length === 0}
            onClick={() => setRevisionMenu(!revisionMenu)}
          >
            {current === undefined ? "REV —" : `REV ${String(current).padStart(2, "0")}`}
          </button>
          <button
            disabled={index < 0 || index >= revisions.length - 1}
            title="Next revision"
            onClick={() => props.onSelectRevision(revisions[index + 1]!.number)}
          >
            <Icon name="chevron-right" size={13} />
          </button>
        </div>
        <div className="cell mono">
          <Rolling value={report ? `${size(report.boundingBox.size)} mm` : "—"} />
        </div>
        <div className="cell mono">
          <Rolling value={report ? plural(report.parts.length, "part").toUpperCase() : "—"} />
        </div>
        {revisionMenu
          ? (
            <div className="menu revisions" onMouseLeave={() => setRevisionMenu(false)}>
              {[...revisions].reverse().map((revision) => (
                <button
                  key={revision.number}
                  className={revision.number === current ? "menu-item on" : "menu-item"}
                  onClick={() => { setRevisionMenu(false); props.onSelectRevision(revision.number); }}
                >
                  <span className="mono">REV {String(revision.number).padStart(2, "0")}</span>
                  <span className="note">{revision.note}</span>
                </button>
              ))}
            </div>
          )
          : null}
      </div>

      <div className="topbar-right">
        <button className="quiet" onClick={props.onToggleCode} title="Code drawer (⌘J)">
          <Icon name="code" />
        </button>
        <div className="export">
          <button
            className="quiet"
            title="Export"
            onClick={() => setExportMenu(!exportMenu)}
            disabled={current === undefined || props.exporting !== "idle"}
          >
            {props.exporting === "idle" ? <Icon name="download" /> : null}
            {props.exporting === "working" ? <span className="ring" /> : null}
            {props.exporting === "done" ? <Icon name="check" /> : null}
          </button>
          {exportMenu
            ? (
              <div className="menu right" onMouseLeave={() => setExportMenu(false)}>
                <button className="menu-item" onClick={() => { setExportMenu(false); props.onExport("step"); }}>
                  STEP <span className="note">B-rep solid</span>
                </button>
                <button className="menu-item" onClick={() => { setExportMenu(false); props.onExport("stl"); }}>
                  STL <span className="note">triangle mesh</span>
                </button>
              </div>
            )
            : null}
        </div>
        <div className="export">
          <button className="quiet" title="Theme" onClick={() => setThemeMenu(!themeMenu)}>
            <Icon name={props.theme === "dark" ? "moon" : "sun"} />
          </button>
          {themeMenu
            ? (
              <div className="menu right" onMouseLeave={() => setThemeMenu(false)}>
                {(["system", "light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={props.themeMode === mode ? "menu-item on" : "menu-item"}
                    onClick={() => { setThemeMenu(false); props.onThemeMode(mode); }}
                  >
                    <span className="check">{props.themeMode === mode ? <Icon name="check" size={12} /> : null}</span>
                    <Icon name={mode === "system" ? "monitor" : mode === "light" ? "sun" : "moon"} size={14} />
                    {mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            )
            : null}
        </div>
      </div>
    </header>
  );
}
