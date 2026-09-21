import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../bridge.ts";
import { session } from "../session.ts";
import { useSculpt } from "./state.ts";
import { useImageDrop } from "./use-image-drop.ts";
import { useTheme } from "./use-theme.ts";
import { TopBar } from "./TopBar.tsx";
import { Rail } from "./Rail.tsx";
import { Chat } from "./Chat.tsx";
import { Composer } from "./Composer.tsx";
import { ViewportCanvas } from "./ViewportCanvas.tsx";
import { CodeDrawer } from "./CodeDrawer.tsx";
import { Empty } from "./Empty.tsx";
import type { Pin } from "../../shared/project.ts";
import { EMPTY_TURN } from "../../shared/transcript.ts";

export function App(): React.JSX.Element {
  const { state, patch, openProject, createProject, selectRevision, refreshForMenu } = useSculpt();
  const { mode, theme, setMode } = useTheme();
  const [showCode, setShowCode] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [zoom, setZoom] = useState<string>();
  const [pulsed, setPulsed] = useState<number>();
  const [draft, setDraft] = useState("");
  const [exporting, setExporting] = useState<"idle" | "working" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const project = state.project;
  const preview = useRef<number | undefined>(undefined);
  const dragging = useImageDrop(project?.summary.id);

  useEffect(() => {
    if (!state.running) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [state.running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        setShowCode((value) => !value);
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        setRailOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addPin = useCallback((pin: Omit<Pin, "index">) => {
    patch({ pins: [...state.pins, { ...pin, index: state.pins.length + 1 }] });
  }, [patch, state.pins]);

  const removePin = useCallback((index: number) => {
    patch({
      pins: state.pins
        .filter((pin) => pin.index !== index)
        .map((pin, position) => ({ ...pin, index: position + 1 })),
    });
  }, [patch, state.pins]);

  const send = async (text: string, imageIds: string[]): Promise<void> => {
    if (!project || !state.engine) return;
    const viewport = session.viewport;
    const attach = viewport !== undefined && viewport.hasModel()
      && (state.pins.length > 0 || state.attachView);
    const view = attach ? viewport.snapshot(state.pins).split(",")[1] : undefined;
    patch({ running: true, turn: EMPTY_TURN, error: undefined });
    try {
      await bridge().call("turn.start", {
        projectId: project.summary.id,
        text,
        engine: state.engine,
        pins: state.pins,
        imageIds,
        ...(viewport ? { camera: viewport.cameraPose() } : {}),
        ...(view ? { view } : {}),
      });
    } catch (error) {
      patch({ running: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const exportModel = async (format: "step" | "stl"): Promise<void> => {
    setExporting("working");
    try {
      const data = await session.client.export(format);
      const name = `${project?.summary.name ?? "model"}.${format}`;
      await bridge().call("file.save", { name, data: bytesToBase64(data) });
      setExporting("done");
      setTimeout(() => setExporting("idle"), 1200);
    } catch (error) {
      setExporting("idle");
      patch({ error: error instanceof Error ? error.message : String(error) });
    }
  };

  const revision = project?.revisions.find((entry) => entry.number === project.currentRevision);
  const active = state.engines.find((entry) => entry.id === state.engine?.adapterId);
  const engineReady = active?.models.status === "available";
  const emptyLine = engineReady
    ? "Each successful build becomes a revision. Click the model to place a pin."
    : "No engine is ready. Sign in to Claude Code or Codex, then open the engine menu below.";

  return (
    <div className={dragging ? "shell dragging" : "shell"}>
      <TopBar
        project={project}
        projects={state.projects}
        theme={theme}
        themeMode={mode}
        exporting={exporting}
        railOpen={railOpen}
        onToggleRail={() => setRailOpen(!railOpen)}
        onOpen={(id) => void openProject(id)}
        onCreate={() => void createProject()}
        onSelectRevision={(value) => void selectRevision(value)}
        onExport={(format) => void exportModel(format)}
        onToggleCode={() => setShowCode(!showCode)}
        onThemeMode={setMode}
      />

      <main className={railOpen ? undefined : "collapsed"}>
        <Rail
          projectId={project?.summary.id}
          revision={revision}
          images={project?.images ?? []}
          onRemoveImage={(imageId) => {
            if (project) void bridge().call("images.remove", { projectId: project.summary.id, imageId });
          }}
        />

        <section className="stage">
          <ViewportCanvas
            pulsed={pulsed}
            rebuilding={state.rebuilding}
            kernel={state.kernel}
            pins={state.pins}
            onPin={addPin}
            onRemovePin={removePin}
            ready={() => session.viewport?.setTheme(theme)}
          />
          {project && !revision && !state.running && state.kernel.ready
            ? <Empty onPick={(text) => void send(text, [])} />
            : null}
          {showCode && project?.source
            ? (
              <CodeDrawer
                source={project.source}
                title={`REV ${String(project.currentRevision).padStart(2, "0")} · ${revision?.note ?? ""}`}
                onClose={() => setShowCode(false)}
              />
            )
            : null}
        </section>

        <aside className="panel">
          <Chat
            project={project}
            turn={state.turn}
            running={state.running}
            onRevision={(value) => void selectRevision(value)}
            onPreview={(value) => previewRevision(value)}
            onZoom={(url) => setZoom(url)}
            onEdit={(text) => setDraft(text)}
            emptyLine={emptyLine}
          />
          <Composer
            pins={state.pins}
            images={project?.images ?? []}
            running={state.running}
            elapsed={elapsed}
            activity={state.activity}
            attachView={state.attachView}
            hasModel={revision !== undefined}
            engines={state.engines}
            engine={state.engine}
            notice={state.notice}
            onEngine={(choice) => {
              patch({ engine: choice });
              if (project) void bridge().call("projects.engine", { id: project.summary.id, engine: choice });
            }}
            onEngineMenu={refreshForMenu}
            projectId={project?.summary.id}
            draft={draft}
            dragging={dragging}
            error={state.error}
            onDraft={setDraft}
            onDismissError={() => patch({ error: undefined })}
            onAttachView={(value) => patch({ attachView: value })}
            onRemovePin={removePin}
            onHoverPin={(index) => setPulsed(index)}
            onSend={(text, imageIds) => void send(text, imageIds)}
            onFollowUp={(text) => void bridge().call("turn.followUp", { text })}
            onStop={() => void bridge().call("turn.cancel", null)}
          />
        </aside>
      </main>
      {zoom
        ? <div className="lightbox" onClick={() => setZoom(undefined)}><img src={zoom} alt="" /></div>
        : null}
    </div>
  );

  function previewRevision(revision: number | undefined): void {
    if (revision === undefined) {
      if (preview.current !== undefined) {
        preview.current = undefined;
        void selectRevision(project?.currentRevision ?? 0, true);
      }
      return;
    }
    if (revision === project?.currentRevision) return;
    preview.current = revision;
    void selectRevision(revision, true);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary);
}
