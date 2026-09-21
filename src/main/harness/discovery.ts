import type { HarnessRuntime } from "reins";
import type { HarnessDiscovery, HarnessLimit, HarnessModel } from "reins/profile";
import type { EngineInfo, EngineLimit, EngineModel } from "../../shared/ipc.ts";

function model(entry: HarnessModel): EngineModel {
  const efforts = entry.effort?.options ?? [];
  return {
    id: entry.id,
    label: entry.label,
    ...(entry.description ? { description: entry.description } : {}),
    ...(efforts.length > 0 ? { efforts: efforts.map((option) => ({ id: option.id, label: option.label })) } : {}),
    ...(entry.effort?.defaultOptionId ? { defaultEffort: entry.effort.defaultOptionId } : {}),
  };
}

function window(limit: HarnessLimit): EngineLimit {
  return {
    id: limit.id,
    label: limit.label,
    unit: limit.unit,
    ...(limit.usedPercent !== undefined ? { usedPercent: limit.usedPercent } : {}),
    ...(limit.used !== undefined ? { used: limit.used } : {}),
    ...(limit.limit !== undefined ? { limit: limit.limit } : {}),
    ...(limit.remaining !== undefined ? { remaining: limit.remaining } : {}),
    ...(limit.resetsAt ? { resetsAt: limit.resetsAt } : {}),
  };
}

/** A discovery source that throws is an unavailable source, not a broken picker. */
async function attempt<T>(read: () => Promise<HarnessDiscovery<T>>, label: string): Promise<HarnessDiscovery<T>> {
  try {
    return await read();
  } catch (error) {
    return { status: "unavailable", message: `${label} failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * The picker is built only from what the harness reports, never from engine
 * names. The sources cache in the main process, so asking again is cheap.
 */
export async function describeEngines(runtime: HarnessRuntime, ids: string[]): Promise<EngineInfo[]> {
  return Promise.all(ids.map(async (id) => {
    const [profile, models, limits] = await Promise.all([
      attempt(() => runtime.profile(id), "Profile"),
      attempt(() => runtime.models(id), "Model discovery"),
      attempt(() => runtime.limits(id), "Limit discovery"),
    ]);
    const controls = profile.status === "available" ? profile.value.controls ?? [] : [];
    return {
      id,
      label: profile.status === "available" ? profile.value.label : id,
      models: models.status === "available"
        ? {
            status: "available",
            ...(models.value.defaultModelId ? { defaultModelId: models.value.defaultModelId } : {}),
            models: models.value.models.filter((entry) => !entry.hidden).map(model),
          }
        : { status: models.status, message: models.message ?? "", models: [] },
      controls: controls.flatMap((control) => control.kind === "select"
        ? [{
            id: control.id,
            label: control.label,
            options: control.options.map((option) => ({ id: option.id, label: option.label })),
            ...(control.defaultValue ? { defaultValue: control.defaultValue } : {}),
          }]
        : []),
      limits: limits.status === "available"
        ? {
            status: "available",
            ...(limits.value.planLabel ? { planLabel: limits.value.planLabel } : {}),
            windows: limits.value.limits.map(window),
          }
        : { status: limits.status, message: limits.message ?? "", windows: [] },
    } satisfies EngineInfo;
  }));
}
