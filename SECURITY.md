# Security policy

## Supported versions

Only the latest commit on `main` receives security fixes. Sculpt has no
releases.

## What Sculpt does

- The agent can call only the seven modeling tools. It has no shell, no file
  tools, and no network tools.
- Each engine process receives an explicit environment. Sculpt does not forward
  its complete environment.
- The script that the agent writes runs in a Web Worker inside the sandboxed
  renderer, under a Content Security Policy that permits no network origin, with
  a 20-second wall clock.
- The renderer runs in a sandbox with context isolation and a strict Content
  Security Policy.
- Reference images and part names are sent to the engine as untrusted content.

Read the Safety section of the [README](README.md#safety) for the details.

## What Sculpt does not do

Sculpt does not provide operating-system sandboxing for the engine process. The
engine command-line tool runs with the permissions of your user account.

The worker is containment, not a sandbox for hostile code. A script can spin
the worker until it is killed, and it can allocate memory. It cannot reach the
document, Node.js, IPC, or the network.

## Report a vulnerability

Report a vulnerability privately through the
[GitHub security advisory flow](https://github.com/serhiitroinin/sculpt/security/advisories/new).
Do not open a public issue.

Include the commit, the reproduction steps, and the impact that you observed.
