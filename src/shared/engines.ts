export interface EngineOption {
  id: string;
  defaultModelId?: string;
}

export interface EngineSelection {
  adapterId: string;
  model?: string;
  fellBack: boolean;
}

/**
 * A project can remember an engine that this run does not offer (the offline
 * engine in a live build). Fall back instead of failing with UNKNOWN_ADAPTER,
 * and keep the stored choice until the user changes it.
 */
export function resolveEngine(
  remembered: { adapterId: string; model?: string } | undefined,
  available: EngineOption[],
): EngineSelection | undefined {
  const first = available[0];
  if (!first) return undefined;
  const match = remembered && available.find((engine) => engine.id === remembered.adapterId);
  if (match) {
    const model = remembered?.model ?? match.defaultModelId;
    return { adapterId: match.id, ...(model ? { model } : {}), fellBack: false };
  }
  return {
    adapterId: first.id,
    ...(first.defaultModelId ? { model: first.defaultModelId } : {}),
    fellBack: remembered !== undefined,
  };
}

interface ModelEfforts {
  id: string;
  efforts?: { id: string }[];
}

/** Switching model keeps everything but an effort the new model does not take. */
export function withModel<T extends { adapterId: string; model?: string; effort?: string }>(
  choice: T | undefined,
  adapterId: string,
  next: ModelEfforts,
): T {
  const { effort, ...rest } = choice?.adapterId === adapterId ? choice : ({ adapterId } as T);
  const offered = effort !== undefined && (next.efforts ?? []).some((option) => option.id === effort);
  return { ...rest, adapterId, model: next.id, ...(offered ? { effort } : {}) } as T;
}

interface LimitWindow {
  label: string;
  unit: string;
  usedPercent?: number;
  used?: number;
  limit?: number;
  remaining?: number;
  resetsAt?: string;
}

/** 0 to 100, or undefined when the engine reports an amount instead of a share. */
export function limitPercent(limit: LimitWindow): number | undefined {
  const clamp = (value: number): number => Math.max(0, Math.min(100, value));
  if (limit.usedPercent !== undefined) return clamp(limit.usedPercent);
  if (limit.limit !== undefined && limit.limit > 0 && limit.used !== undefined) {
    return clamp((limit.used / limit.limit) * 100);
  }
  return undefined;
}

export function limitResets(limit: LimitWindow, now: number): string | undefined {
  const at = limit.resetsAt ? Date.parse(limit.resetsAt) : Number.NaN;
  if (!Number.isFinite(at)) return undefined;
  const hours = Math.round((at - now) / 3_600_000);
  if (hours <= 0) return "resets soon";
  return hours < 48 ? `resets in ${hours} h` : `resets in ${Math.round(hours / 24)} d`;
}

/** `42%`, or `12 credits left` for a limit that is an amount. */
export function limitValue(limit: LimitWindow): string {
  const percent = limitPercent(limit);
  if (percent !== undefined) return `${Math.round(percent)}%`;
  if (limit.remaining !== undefined) return `${limit.remaining} ${limit.unit} left`;
  if (limit.used !== undefined && limit.limit !== undefined) return `${limit.used} of ${limit.limit}`;
  return "";
}
