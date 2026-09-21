# Contributing

Sculpt is a showcase for [Reins](https://github.com/serhiitroinin/reins). It is
small on purpose. A change that makes the Reins integration clearer is welcome.
A large new feature is probably out of scope. Open an issue first.

Read the [code of conduct](CODE_OF_CONDUCT.md). Report a security problem
through the process in [SECURITY.md](SECURITY.md). Do not open a public issue
for it.

## Prerequisites

| Tool | Version |
| --- | --- |
| macOS | 12 or newer |
| [Bun](https://bun.sh) | 1.3 or newer |

## Commands

```sh
bun install
bun run typecheck
bun test
bun run build
bun run dev:offline      # the offline engine; no account is necessary
bun run e2e              # builds, starts a hidden window, and checks the interactive paths
```

The scripts in `scripts/` start the application on a temporary data directory
and operate it. Read the Development section of the
[README](README.md#development).

## Rules

- Use the offline engine for development. A live turn uses your own Claude Code
  or Codex account.
- Do not commit account data. A screenshot must not show a plan name, a usage
  value, or a reset time.
- Pin exact dependency versions.
- Every example in the bundled replicad reference (`src/shared/reference/`) is
  built by `tests/reference.test.ts`. A change to an example must still build.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org).
- `bun run typecheck` and `bun test` must pass.
