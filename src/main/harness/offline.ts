import type {
  HarnessAdapter,
  HarnessAdapterEvent,
  HarnessAdapterFollowUpRequest,
  HarnessAdapterRunRequest,
} from "reins";
import type { HarnessCapabilities } from "reins/protocol";
import { OFFLINE_SCENARIOS, type OfflineScenario, type OfflineStep } from "./offline-models.ts";

export const OFFLINE_ENGINE = "kit:offline";

const CAPABILITIES: HarnessCapabilities = {
  resume: { support: "stable" },
  cancel: { support: "stable" },
  interactions: { support: "unsupported" },
  tools: { support: "stable" },
  images: { support: "stable" },
  thinking: { support: "stable" },
  plans: { support: "unsupported" },
  usage: { support: "stable" },
  subagents: { support: "unsupported" },
  shell: { support: "unsupported" },
  filesystem: { support: "unsupported" },
  network: { support: "unsupported" },
  steering: { support: "stable", strategies: ["same-turn"], preferred: "same-turn" },
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function textOf(parts: HarnessAdapterRunRequest["input"]): string {
  return parts.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join(" ");
}

/** The pace of the fixture turn, so a test can steer or stop it mid-flight. */
const STEP_MS = Number(process.env.SCULPT_OFFLINE_STEP_MS ?? 120);

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

function toolCalls(step: OfflineStep): ToolCall[] {
  return [
    ...step.reads.map((topic) => ({ name: "read_reference", input: { topic } })),
    { name: "set_model", input: { source: step.source, note: step.note } },
    { name: "render_views", input: { views: step.views, size: 320 } },
    ...(step.measure ? [{ name: "measure", input: { ...step.measure } }] : []),
  ];
}

async function* script(
  request: HarnessAdapterRunRequest,
  steered: string[],
  scenario: OfflineScenario,
  turn: number,
): AsyncIterable<HarnessAdapterEvent> {
  const step = scenario.steps(turn);
  yield { kind: "thinking", text: step.thinking };
  await wait(STEP_MS);
  yield { kind: "assistant-text", text: `Offline engine, scripted ${scenario.id}. ` };
  await wait(STEP_MS);

  let failure: string | undefined;
  let index = 0;
  for (const call of toolCalls(step)) {
    index += 1;
    const toolId = `offline-${index}`;
    yield { kind: "tool-started", toolId, toolKind: "application", title: call.name };
    const result = await request.tools.call(call.name, call.input);
    const first = result.content[0];
    const text = first?.type === "text" ? first.text : "";
    if (call.name === "set_model" && result.isError) failure = text;
    yield {
      kind: "tool-completed",
      toolId,
      toolKind: "application",
      title: call.name,
      status: result.isError ? "failed" : "completed",
      ...(call.name === "set_model" && text ? { outputAppend: text.slice(0, 400) } : {}),
    };
    await wait(call.name === "render_views" ? STEP_MS * 3 : STEP_MS);
    if (failure !== undefined) break;
  }

  yield {
    kind: "assistant-text",
    text: failure !== undefined ? `The build failed.\n${failure}` : step.reply,
  };
  for (const follow of steered.splice(0)) {
    await wait(STEP_MS);
    yield { kind: "assistant-text", text: `Noted while running: ${follow}` };
  }
  yield { kind: "usage", usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 } };
}

/**
 * A deterministic engine for development and tests. It exercises the same tool
 * host and supports same-turn steering, so the product path is tested without
 * spending a subscription.
 */
export function createOfflineEngine(): HarnessAdapter {
  return {
    id: OFFLINE_ENGINE,
    capabilities: () => CAPABILITIES,
    profile: () => ({
      status: "available",
      value: {
        id: OFFLINE_ENGINE,
        label: "Offline",
        modelSelection: "optional",
        permissions: {
          kind: "permission-mode",
          selectable: false,
          defaultModeId: "app-tools-only",
          modes: [{ id: "app-tools-only", label: "Application tools only", posture: "restricted" }],
        },
        inputPolicy: { modalities: { text: { support: "stable" }, image: { support: "stable" } } },
      },
    }),
    models: () => ({
      status: "available",
      value: {
        selection: "optional",
        defaultModelId: "fixture",
        models: [{ id: "fixture", label: "Scripted", description: "bracket, enclosure, phone stand" }],
      },
    }),
    limits: () => ({ status: "unsupported", message: "The offline engine has no account." }),
    open: async () => {
      const steered: string[] = [];
      let scenario: OfflineScenario | undefined;
      let turn = 0;
      return {
        run: (request) => {
          // A prompt that names another model starts that scenario from its first revision.
          const prompt = textOf(request.input);
          const named = OFFLINE_SCENARIOS.find((entry) => entry.id !== "bracket" && entry.match.test(prompt));
          const next = named ?? scenario ?? OFFLINE_SCENARIOS.find((entry) => entry.id === "bracket")!;
          if (next !== scenario) turn = 0;
          scenario = next;
          return script(request, steered, scenario, turn++);
        },
        steer: async (request: HarnessAdapterFollowUpRequest) => {
          steered.push(textOf(request.input));
        },
        cancel: async () => undefined,
      };
    },
  };
}
