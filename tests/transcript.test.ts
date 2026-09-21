import { expect, test } from "bun:test";
import { EMPTY_TURN, mergeUsage, reduceTurn } from "../src/shared/transcript.ts";
import type { HarnessEventPayload } from "reins/protocol";

const text = (value: string): HarnessEventPayload => ({ kind: "assistant-text", text: value });
const toolStarted: HarnessEventPayload = {
  kind: "tool-started", toolId: "1", toolKind: "tool", title: "set_model",
};
const toolCompleted: HarnessEventPayload = {
  kind: "tool-completed", toolId: "1", toolKind: "tool", title: "set_model", status: "completed",
};

function run(payloads: HarnessEventPayload[], clock = () => 0): ReturnType<typeof reduceTurn> {
  return payloads.reduce((state, payload) => reduceTurn(state, payload, clock()), EMPTY_TURN);
}

test("assistant text that resumes after a tool call starts a new paragraph", () => {
  const turn = run([text("I'll make a stand."), toolStarted, toolCompleted, text("Created a 70 mm stand.")]);
  expect(turn.text).toBe("I'll make a stand.\n\nCreated a 70 mm stand.");
});

test("streamed deltas inside one message are joined without a break", () => {
  const turn = run([text("Created "), text("a 70 mm "), text("stand.")]);
  expect(turn.text).toBe("Created a 70 mm stand.");
});

test("a tool call before any text adds no leading break", () => {
  const turn = run([toolStarted, toolCompleted, text("Done.")]);
  expect(turn.text).toBe("Done.");
});

test("thinking time is measured between the first thought and the next tool call", () => {
  let now = 1000;
  const clock = (): number => now;
  let turn = reduceTurn(EMPTY_TURN, { kind: "thinking", text: "..." }, clock());
  now = 7500;
  turn = reduceTurn(turn, toolStarted, clock());
  expect(turn.thinkingMs).toBe(6500);
});

test("the empty usage of turn-completed never overwrites the real usage", () => {
  const turn = run([
    { kind: "usage", usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 } },
    { kind: "turn-completed", status: "completed", usage: { durationMs: 900 } },
  ]);
  expect(turn.usage).toEqual({ inputTokens: 120, outputTokens: 40, totalTokens: 160, durationMs: 900 });
});

test("merging keeps the earlier value when the later one is absent", () => {
  expect(mergeUsage({ totalTokens: 10 }, {})).toEqual({ totalTokens: 10 });
  expect(mergeUsage(undefined, { totalTokens: 3 })).toEqual({ totalTokens: 3 });
  expect(mergeUsage({ totalTokens: 10 }, undefined)).toEqual({ totalTokens: 10 });
});
