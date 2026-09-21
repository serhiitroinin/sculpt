import { execFileSync } from "node:child_process";
import {
  copyFileSync, lstatSync, mkdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  CODEX_SERVICE_TIER_CONTROL_ID,
  createClaudeAgentSdkAdapter,
  createClaudeAgentSdkConnector,
  createClaudeAgentSdkDiscovery,
  createCodexAppServerAdapter,
  createCodexAppServerDiscovery,
  createCodexAppServerProcessConnector,
  type CodexAppServerConnectRequest,
  type HarnessAdapter,
  type HarnessDiscovery,
  type HarnessEngineProfile,
} from "reins";

export const CLAUDE_ENGINE = "kit:claude";
export const CODEX_ENGINE = "kit:codex";

export interface EngineKitOptions {
  appName: string;
  appVersion: string;
  /** An empty private directory. The agent gets no shell, so nothing reads it. */
  workspace: string;
  /** Private application data. The Codex session home lives here. */
  dataDir: string;
  systemPrompt: string;
  onStderr?(engine: string, text: string): void;
}

const ENV_ALLOWLIST = [
  "PATH", "USER", "TMPDIR", "LANG", "LC_ALL", "TERM",
  "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
];

function exactEnvironment(): Record<string, string> {
  return Object.fromEntries(ENV_ALLOWLIST.flatMap((name) => {
    const value = process.env[name];
    return value === undefined ? [] : [[name, value]];
  }));
}

const APP_TOOL_PREFIX = "mcp__reins__";
const TOOL_OUTPUT_MAX = 4000;

/**
 * Both native adapters drop every tool output by default. Sculpt keeps the
 * output of its own tools so a failed build can be read in the transcript, and
 * keeps dropping everything else.
 */
function claudeToolOutput(tool: { name: string }, output: string): string {
  return tool.name.startsWith(APP_TOOL_PREFIX) ? output.slice(0, TOOL_OUTPUT_MAX) : "";
}

function codexToolOutput(tool: { kind: string; name?: string }, output: string): string {
  return tool.kind === "dynamic" || tool.kind === "mcp" ? output.slice(0, TOOL_OUTPUT_MAX) : "";
}

const imageInput = {
  modalities: { text: { support: "stable" as const }, image: { support: "stable" as const } },
};

function profile(id: string, label: string, codex: boolean): HarnessDiscovery<HarnessEngineProfile> {
  return {
    status: "available",
    value: {
      id,
      label,
      modelSelection: "optional",
      permissions: {
        kind: codex ? "approval-policy" : "permission-mode",
        selectable: false,
        defaultModeId: "app-tools-only",
        modes: [{ id: "app-tools-only", label: "Application tools only", posture: "restricted" }],
      },
      inputPolicy: imageInput,
      ...(codex ? {
        controls: [{
          id: CODEX_SERVICE_TIER_CONTROL_ID,
          label: "Speed",
          kind: "select" as const,
          scope: "turn" as const,
          options: [{ id: "default", label: "Standard" }, { id: "priority", label: "Fast" }],
          defaultValue: "default",
        }],
      } : {}),
    },
  };
}

/**
 * Codex refreshes a token by renaming a new file over `auth.json`. A copied
 * credential would then diverge from `~/.codex` and one side loses its login.
 * A symlink keeps one credential; a regular file found here is a refresh that
 * replaced the link, so the newer one is published back before relinking.
 */
function linkCodexAuth(privateHome: string, accountHome: string): void {
  const link = join(privateHome, "auth.json");
  const target = join(accountHome, "auth.json");
  const found = lstatSync(link, { throwIfNoEntry: false });
  if (found?.isFile()) {
    const current = statSync(target, { throwIfNoEntry: false });
    if (!current || found.mtimeMs > current.mtimeMs) {
      const staged = join(accountHome, `.kit-auth-${process.pid}`);
      copyFileSync(link, staged);
      renameSync(staged, target);
    }
  } else if (found && !found.isSymbolicLink()) {
    throw new Error("The Codex session home holds an auth.json this application did not write.");
  }
  rmSync(link, { force: true });
  symlinkSync(target, link);
}

function codexHome(dataDir: string): string {
  const accountHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const privateHome = join(dataDir, "codex-home");
  mkdirSync(privateHome, { recursive: true, mode: 0o700 });
  linkCodexAuth(privateHome, accountHome);
  // App Server loads a config.toml in full, including mcp_servers. Own the file.
  rmSync(join(privateHome, "config.toml"), { force: true });
  writeFileSync(join(privateHome, "config.toml"), "# Written by the application.\n", { mode: 0o600 });
  return privateHome;
}

const CODEX_ARGS = [
  "app-server", "--stdio", "--strict-config",
  "--disable", "shell_tool", "--disable", "unified_exec", "--disable", "shell_snapshot",
  "-c", "skills.include_instructions=false",
  "-c", "skills.bundled.enabled=false",
  "-c", "cli_auth_credentials_store=\"file\"",
];

function codexCommand(): string {
  return execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
}

function codexEnvironment(dataDir: string): Record<string, string> {
  const home = codexHome(dataDir);
  return { ...exactEnvironment(), HOME: home, CODEX_HOME: home, NO_COLOR: "1" };
}

/** A turn changes the limits, so a snapshot older than this is read again. */
const LIMITS_TTL_MS = 20_000;

export function createEngines(options: EngineKitOptions): HarnessAdapter[] {
  mkdirSync(options.workspace, { recursive: true, mode: 0o700 });

  // The model list, the effort levels and the plan limits all come from the
  // account: one short-lived SDK process answers, no turn starts.
  const claudeEnvironment = () => ({ ...exactEnvironment(), HOME: homedir(), NO_COLOR: "1" });
  const claudeDiscovery = createClaudeAgentSdkDiscovery({
    limitsTtlMs: LIMITS_TTL_MS,
    configure: () => ({ cwd: options.workspace, env: claudeEnvironment() }),
    onStderr: (chunk) => options.onStderr?.(CLAUDE_ENGINE, chunk),
  });
  const claude = createClaudeAgentSdkAdapter({
    id: CLAUDE_ENGINE,
    events: { redactToolOutput: claudeToolOutput },
    profile: profile(CLAUDE_ENGINE, "Claude Code", false),
    models: claudeDiscovery.models,
    limits: claudeDiscovery.limits,
    authorizeTool: (request) => request.toolName.startsWith(APP_TOOL_PREFIX)
      ? { behavior: "allow", updatedInput: request.input }
      : { behavior: "deny", message: "Only application tools are available." },
    connect: createClaudeAgentSdkConnector({
      onStderr: (chunk) => options.onStderr?.(CLAUDE_ENGINE, chunk),
      configure: () => ({
        cwd: options.workspace,
        env: claudeEnvironment(),
        tools: [],
        skills: [],
        settingSources: [],
        strictMcpConfig: true,
        permissionMode: "default",
        systemPrompt: options.systemPrompt,
        persistSession: true,
      }),
    }),
  });

  const clientInfo = { name: options.appName, title: options.appName, version: options.appVersion };
  const codexProcess = () => createCodexAppServerProcessConnector({
    command: codexCommand(),
    args: CODEX_ARGS,
    cwd: options.workspace,
    env: codexEnvironment(options.dataDir),
    onStderr: (chunk) => options.onStderr?.(CODEX_ENGINE, new TextDecoder().decode(chunk)),
  });
  const codexDiscovery = createCodexAppServerDiscovery({
    clientInfo,
    limitsTtlMs: LIMITS_TTL_MS,
    connect: (request) => codexProcess()(request as CodexAppServerConnectRequest),
  });
  const codex = createCodexAppServerAdapter({
    id: CODEX_ENGINE,
    events: { redactToolOutput: codexToolOutput },
    clientInfo,
    profile: profile(CODEX_ENGINE, "Codex", true),
    models: codexDiscovery.models,
    limits: codexDiscovery.limits,
    thread: (request) => ({
      cwd: options.workspace,
      sandbox: "read-only",
      approvalPolicy: "never",
      ...(request.model ? { model: request.model } : {}),
    }),
    connect: (request) => codexProcess()(request),
  });

  return [claude, codex];
}
