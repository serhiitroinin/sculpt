# Reins notes for this project

These notes record what was verified live on 2026-09-17 against
`reins@0.2.0`, Claude Code 2.1.274, and codex-cli 0.154.0.
Read them before you touch the engine wiring.

## Where the documentation is

The installed package carries its own documentation. Read it there, not from memory:

- `node_modules/reins/README.md`
- `node_modules/reins/docs/getting-started/*.md`
- `node_modules/reins/docs/SIDECAR_V1.md`
- `node_modules/reins/docs/ARCHITECTURE.md`
- `node_modules/reins/src/*.ts` (the types are the contract)
- `node_modules/reins/examples/incident-terminal/host.ts`
  (a complete non-Reins host: discovery, context, tools, confirmation, replay)
- `node_modules/reins/bindings/swift` (generated `Codable` types)

## The engine kit

`engines.ts` is a verified file. It builds one Claude Code adapter and one Codex
adapter with a closed tool surface. Both passed a live turn with an image
input, an application tool call, and a context-source instruction. Change it
only when you have a reason, and run a live smoke after you change it.

What the kit guarantees:

- Claude runs with `tools: []`, `skills: []`, `settingSources: []`, and
  `strictMcpConfig: true`. The agent has no shell, no file tools, and no web.
  `authorizeTool` allows only the application tool server
  (`mcp__reins__*`) and denies every other tool.
- Codex runs `app-server` with the shell tools disabled, a `read-only` sandbox,
  and approval policy `never`. Application tools arrive as dynamic tools.
- Both engines get an exact environment allowlist. The host environment is
  never inherited.
- Codex runs under a private `CODEX_HOME` inside the application data
  directory. `auth.json` is a SYMLINK to the account file. Never copy it: a
  token refresh in a copy logs the user out of the Codex CLI.
- Codex models come from a live `model/list` call. Claude models are the three
  stable aliases.

## Facts that are easy to get wrong

1. `harness.models(adapterId)`, `harness.profile(adapterId)`, and
   `harness.limits(adapterId)` take the adapter id as a STRING. Each returns
   `{ status: "available" | "unavailable" | "unsupported" }`. Render all three
   states. Never block the model picker on limits.
2. Codex has no system-prompt field in the thread policy. Put application
   instructions in a context source (`instructions` is trusted, `content` is
   untrusted). That path works the same on both engines. Keep the Claude
   `systemPrompt` short and generic.
3. Image input works on both engines: `{ type: "image", mediaType, data: Uint8Array }`.
   Tool results can also return images: `{ type: "image", mediaType, data: <base64 string> }`.
   The agent can therefore look at a render of its own work.
4. Tool input arrives as `unknown`. Give every tool a strict `inputSchema`
   (`additionalProperties: false`). Do NOT rely on the `validate` hook for the
   message: `createToolHost` catches a thrown error and replaces it with
   "Invalid input for tool: <name>". A thrown error inside `execute` is
   replaced the same way. Validate inside `execute` and RETURN the model-facing
   text as a tool result with `isError: true`. (Verified 2026-09-17 against
   0.1.1, `src/tools.ts`.)
4b. Both native adapters drop tool output from the event stream:
   `events.redactToolOutput` defaults to `() => ""`. Pass
   `events: { redactToolOutput }` to each adapter to keep the output of the
   application's own tools. Better still, record the outcome host-side: the
   host already knows what its tool returned.
5. A run is `harness.start(request)`. Iterate `run.events` to the end, then
   read `await run.done` (`completed`, `error`, or `interrupted`).
   `run.cancel()` interrupts and keeps the partial events.
   `run.followUp({ expectedTurnId: run.turnId, input })` steers the active turn
   (both native engines support `same-turn`).
6. The session key is `{ tenantId, actorId, threadId }`. The same key resumes
   the same provider session, also after a restart when the persistence is
   durable. `createFilePersistence({ directory })` from
   `reins/persistence/file` gives durable events and
   checkpoints (absolute private directory, one writer process). Replay a chat
   with `persistence.events.list(session, adapterId, after?)`. Events are
   stored per session AND adapter, so a thread that used two engines needs a
   merge by `timestamp`. User messages are not harness events: the product
   stores its own transcript of what the user sent.
7. Switching the engine inside one thread starts a NEW provider session. The
   new engine does not see the old transcript. If the product allows a
   mid-thread engine switch, rebuild the needed state in a context source.
8. Event kinds: `turn-started`, `assistant-text` (deltas), `thinking`,
   `plan-updated`, `tool-started`, `tool-updated`, `tool-completed`,
   `interaction-requested`, `interaction-resolved`, `interaction-invalidated`,
   `usage`, `error`, `turn-completed`, `extension`. Ignore unknown kinds.
9. Use `createScriptedAdapter` from `reins/testing` as an
   OFFLINE engine for development and tests. It costs nothing and is
   deterministic. It is test-only API: never ship it as a selectable engine in
   a release build, but a `--offline` development flag is fine.

## Dependency rules

- Bun enforces a 7-day minimum release age globally. This is a deliberate
  supply-chain guard. NEVER disable it and never add a package to
  `minimumReleaseAgeExcludes`.
- When a version is too new, pin an OLDER exact version.
- Pin exact versions. Verify that a package name is the canonical one before
  you install it. Keep the dependency list short.
- Electron needs its postinstall to download the binary. Bun blocks
  postinstall scripts, so list it: `"trustedDependencies": ["electron"]`.
  Start Electron under Bun: `bunx --bun electron .`.

## Live-provider budget

Live turns spend your Claude and Codex allowance. Build and test
against the offline scripted engine. Use live turns only to verify real
behavior: prefer `sonnet` or `haiku`, keep prompts small, and stay under about
15 live turns for the whole task.
