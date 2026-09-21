# Third-party notices

Sculpt is licensed under the [MIT License](LICENSE). Sculpt uses the
third-party software and the font in this file. Each item keeps its own
license.

Sculpt has no packaged release. `bun install` downloads each dependency from
the npm registry, and each package contains its own license text in
`node_modules/<package>/`.

## Direct dependencies

The licenses below come from the `package.json` and the license file of each
installed package.

| Package | Version | License | Use |
| --- | --- | --- | --- |
| [`replicad`](https://github.com/sgenoud/replicad) | 1.1.0 | MIT | The modeling API that the agent writes against. Vite bundles it into the worker. |
| [`replicad-opencascadejs`](https://github.com/sgenoud/replicad) | 1.1.0 | LGPL-2.1-only | The OpenCascade kernel, compiled to WebAssembly. Read the section below. |
| [`three`](https://github.com/mrdoob/three.js) | 0.186.0 | MIT | The viewport. Bundled. |
| [`react`](https://github.com/facebook/react) | 19.2.8 | MIT | The renderer. Bundled. |
| [`react-dom`](https://github.com/facebook/react) | 19.2.8 | MIT | The renderer. Bundled. |
| [`reins`](https://github.com/serhiitroinin/reins) | 0.2.0 | MIT | The agent runtime. The main process loads it. |
| [`electron`](https://github.com/electron/electron) | 43.4.1 | MIT | The application shell. |
| [`@fontsource/ibm-plex-mono`](https://github.com/fontsource/fontsource) | 5.3.0 | OFL-1.1 | The monospace font. Read the section below. |

### The OpenCascade kernel

`replicad-opencascadejs` is licensed under the GNU Lesser General Public
License, version 2.1 only. The full text is in
`node_modules/replicad-opencascadejs/LICENSE`. The package is a build of
[Open CASCADE Technology](https://dev.opencascade.org) compiled to
WebAssembly. Sculpt does not change it.

Sculpt keeps the kernel as a separate file. Vite copies the `.wasm` file into
`dist/renderer/assets/` as its own asset, and the worker fetches it at start.
A person who distributes a build of Sculpt can replace that file with another
build of the same library, which is what LGPL-2.1 section 6 asks for. Sculpt's
own code stays under the MIT License.

### Electron, Chromium, and Node.js

Electron is licensed under the MIT License, Copyright (c) Electron contributors
and Copyright (c) 2013-2020 GitHub Inc. The Electron binary contains Chromium,
Node.js, and their dependencies. Their notices are in the installed package:

- `node_modules/electron/dist/LICENSE`
- `node_modules/electron/dist/LICENSES.chromium.html`

## Dependencies of Reins

| Package | Version | License |
| --- | --- | --- |
| [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | 0.3.257 | Proprietary. © Anthropic PBC. Use is subject to the [Anthropic legal agreements](https://code.claude.com/docs/en/legal-and-compliance). |
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | 1.30.0 | MIT |
| [`@agentclientprotocol/sdk`](https://github.com/agentclientprotocol/typescript-sdk) | 1.4.0 | Apache-2.0 |
| [`zod`](https://github.com/colinhacks/zod) | 4.6.5 | MIT |

The Claude Agent SDK is not open-source software. Sculpt does not contain a
copy of it. `bun install` downloads it from the npm registry as a dependency of
Reins.

## Build tools

These packages run only at build time. No code from them is in the built
application.

| Package | Version | License |
| --- | --- | --- |
| [`vite`](https://github.com/vitejs/vite) | 8.2.2 | MIT |
| [`@vitejs/plugin-react`](https://github.com/vitejs/vite-plugin-react) | 6.1.1 | MIT |
| [`typescript`](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 |

To list the license of each installed package, run this command:

```sh
bun pm ls --all
```

Then read `node_modules/<package>/package.json`.

## Fonts

`src/renderer/styles/tokens.css` imports the Latin subset of IBM Plex Mono in
three weights from `@fontsource/ibm-plex-mono`. Vite copies the font files
into the build, and the application loads them from local files.

| Font | Author | License | Source |
| --- | --- | --- | --- |
| IBM Plex Mono | IBM | OFL-1.1 | <https://github.com/IBM/plex> |

The SIL Open Font License 1.1 (OFL-1.1) text is at <https://openfontlicense.org>.

The interface text uses the system font. Sculpt bundles no other font.

## Icons

The interface icons in `src/renderer/app/Icon.tsx` are adapted from
[Lucide](https://lucide.dev). Lucide is licensed under the ISC License.
Portions of Lucide come from Feather, which is licensed under the MIT License,
Copyright (c) 2013-2022 Cole Bemis. The path data lives in the file; there is
no dependency.
