import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../bridge.ts";
import { session } from "../session.ts";
import { serveCadRequest } from "./cad-service.ts";
import type { EngineInfo, MainEvent } from "../../shared/ipc.ts";
import type { EngineChoice, Pin, ProjectState, ProjectSummary } from "../../shared/project.ts";
import { EMPTY_TURN, reduceTurn, type TurnText } from "../../shared/transcript.ts";
import { resolveEngine } from "../../shared/engines.ts";

export interface SculptState {
  projects: ProjectSummary[];
  project: ProjectState | undefined;
  engines: EngineInfo[];
  engine: EngineChoice | undefined;
  running: boolean;
  rebuilding: boolean;
  kernel: { ratio: number; ready: boolean };
  turn: TurnText;
  activity: string | undefined;
  pins: Pin[];
  attachView: boolean;
  error: string | undefined;
  notice: string | undefined;
}

const EMPTY: SculptState = {
  projects: [],
  project: undefined,
  engines: [],
  engine: undefined,
  running: false,
  rebuilding: false,
  kernel: { ratio: 0, ready: false },
  turn: EMPTY_TURN,
  activity: undefined,
  pins: [],
  attachView: false,
  error: undefined,
  notice: undefined,
};

const options = (engines: EngineInfo[]): { id: string; defaultModelId?: string }[] =>
  engines.map((engine) => ({
    id: engine.id,
    ...(engine.models.defaultModelId ? { defaultModelId: engine.models.defaultModelId } : {}),
  }));

/** `?engine=<id fragment>&model=<model id>` picks the start choice, for scripted runs. */
function requested(engines: EngineInfo[]): EngineChoice | undefined {
  const query = new URLSearchParams(window.location.search);
  const wanted = query.get("engine");
  const engine = wanted ? engines.find((entry) => entry.id.includes(wanted)) : undefined;
  if (!engine) return undefined;
  const wantedModel = query.get("model");
  const model = engine.models.models.find((entry) => entry.id === wantedModel)?.id
    ?? wantedModel
    ?? engine.models.defaultModelId;
  return { adapterId: engine.id, ...(model ? { model } : {}) };
}

/** A remembered choice keeps its effort and controls; a fallback starts clean. */
function chosen(
  remembered: EngineChoice | undefined,
  engines: EngineInfo[],
): { engine?: EngineChoice; notice: string | undefined } {
  const selection = resolveEngine(remembered, options(engines));
  if (!selection) return { notice: undefined };
  const base = remembered && !selection.fellBack ? remembered : {};
  return {
    engine: { ...base, adapterId: selection.adapterId, ...(selection.model ? { model: selection.model } : {}) },
    notice: selection.fellBack
      ? `That project remembers an engine this run does not offer. Using ${selection.adapterId}.`
      : undefined,
  };
}

/** Opening the picker reads again after this long; so does focusing the window. */
const MENU_REFRESH_MS = 20_000;
const FOCUS_REFRESH_MS = 60_000;

export function useSculpt() {
  const [state, setState] = useState<SculptState>(EMPTY);
  const pins = useRef<Pin[]>([]);
  const enginesRef = useRef<EngineInfo[]>([]);
  const discovering = useRef(false);
  const discoveredAt = useRef(0);
  pins.current = state.pins;
  enginesRef.current = state.engines;

  const patch = useCallback((next: Partial<SculptState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  /**
   * Discovery is cached in the main process, so asking again is cheap. The
   * first answer also settles the engine choice, which waits for it.
   */
  const refreshEngines = useCallback(async (olderThanMs = 0): Promise<void> => {
    if (discovering.current || Date.now() - discoveredAt.current < olderThanMs) return;
    discovering.current = true;
    try {
      const engines = await bridge().call("engines.list", null);
      discoveredAt.current = Date.now();
      enginesRef.current = engines;
      setState((current) => {
        if (current.engine) return { ...current, engines };
        const start = requested(engines);
        return { ...current, engines, ...(start ? { engine: start } : chosen(current.project?.engine, engines)) };
      });
    } finally {
      discovering.current = false;
    }
  }, []);

  const showModel = useCallback(async (source: string | undefined) => {
    session.report = undefined;
    if (source === undefined) {
      session.viewport?.setModel([], false);
      return;
    }
    patch({ rebuilding: true });
    const result = await session.client.build(source);
    patch({ rebuilding: false });
    if (result.ok) {
      session.viewport?.setModel(result.meshes, false);
      session.report = result.report;
    } else {
      patch({ error: result.failure.message });
    }
  }, [patch]);

  useEffect(() => {
    session.client.onKernel = (kernel) => patch({ kernel });
    // An empty project builds nothing, so nothing else would start the kernel.
    session.client.warm();
    return () => { session.client.onKernel = undefined; };
  }, [patch]);

  useEffect(() => {
    const api = bridge();
    return api.subscribe((message: MainEvent) => {
      if (message.kind === "cad-request") {
        if (message.request.op === "build" || message.request.op === "restore") patch({ rebuilding: true });
        void serveCadRequest(message.request, {
          pins: () => pins.current,
          onBuilt: () => patch({ pins: [], error: undefined, rebuilding: false }),
          onFailed: (error) => patch({ error, rebuilding: false }),
        })
          .then((value) => api.call("cad.result", { id: message.id, ok: true, value }))
          .catch((error: Error) => api.call("cad.result", { id: message.id, ok: false, error: error.message }));
        return;
      }
      if (message.kind === "project") {
        const last = message.project.transcript.at(-1);
        patch({
          project: message.project,
          ...(last?.kind === "activity" ? { activity: last.text } : {}),
        });
        return;
      }
      if (message.kind === "turn-event") {
        const payload = message.payload;
        if (payload.kind === "error") patch({ error: payload.message });
        else setState((current) => ({ ...current, turn: reduceTurn(current.turn, payload) }));
        return;
      }
      patch({
        running: false,
        turn: EMPTY_TURN,
        activity: undefined,
        ...(message.status === "error" && message.message ? { error: message.message } : {}),
      });
      // A turn spends the plan, so the limits are read again.
      void refreshEngines();
    });
  }, [patch, refreshEngines]);

  useEffect(() => {
    const focused = (): void => void refreshEngines(FOCUS_REFRESH_MS);
    window.addEventListener("focus", focused);
    return () => window.removeEventListener("focus", focused);
  }, [refreshEngines]);

  const refreshForMenu = useCallback(() => void refreshEngines(MENU_REFRESH_MS), [refreshEngines]);

  const openProject = useCallback(async (id: string) => {
    const project = await bridge().call("projects.open", { id });
    // Before the first discovery answers there is nothing to choose from.
    const choice = enginesRef.current.length > 0 ? chosen(project.engine, enginesRef.current) : undefined;
    patch({ project, pins: [], error: undefined, ...(choice ?? {}) });
    await showModel(project.source);
  }, [patch, showModel]);

  const createProject = useCallback(async () => {
    const api = bridge();
    const created = await api.call("projects.create", { name: `Project ${Date.now() % 1000}` });
    const projects = await api.call("projects.list", null);
    patch({ project: created, projects, pins: [], error: undefined });
    await showModel(undefined);
  }, [patch, showModel]);

  const selectRevision = useCallback(async (number: number, preview = false) => {
    const id = state.project?.summary.id;
    if (!id) return;
    const source = preview
      ? await bridge().call("revisions.source", { projectId: id, number })
      : (await bridge().call("revisions.select", { projectId: id, number })).source;
    patch({ rebuilding: true });
    const result = await session.client.build(source);
    patch({ rebuilding: false });
    if (!result.ok) {
      patch({ error: result.failure.message });
      return;
    }
    session.viewport?.setModel(result.meshes, true);
    session.report = result.report;
    if (!preview) patch({ pins: [] });
  }, [state.project?.summary.id, patch]);

  useEffect(() => {
    const api = bridge();
    // The engines answer in their own time; the project does not wait for them.
    void refreshEngines();
    void (async () => {
      const projects = await api.call("projects.list", null);
      patch({ projects });
      const first = projects[0];
      if (first) await openProject(first.id);
      else await createProject();
    })();
  }, [patch, openProject, createProject, refreshEngines]);

  return { state, patch, openProject, createProject, selectRevision, refreshForMenu };
}
