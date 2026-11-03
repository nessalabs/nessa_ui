---
id: "ui-distribution"
title: "Consumer surfaces"
kind: "guide"
status: "implemented"
summary: "Choose whether your project imports a published package or owns copied registry source. These routes share implementation but expose different paths and update responsibilities."
parent: "nessa-ui"
sources:
  [
    "README.md",
    "CONTRIBUTING.md",
    "package.json",
    "registry.json",
    "packages/react/package.json",
    "packages/agent-stream/package.json",
    "packages/agent-stream/tsup.config.ts",
    "packages/agent-stream/src/index.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Choose a consumer surface

Choose whether your project imports a published package or owns copied registry source. These routes share implementation but expose different paths and update responsibilities.

| Surface                   | What you consume                                                | What remains your responsibility                           |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| `@nessalabs/ui`           | React components, parser/transcript reexports and CSS entries   | React 19+, application state and selected CSS import       |
| `@nessalabs/agent-stream` | Framework-free parser at `.`, transcript fold at `./transcript` | Transport, process lifetime and storage                    |
| shadcn registry           | Source files and registry dependencies copied into your project | Preserve installed file/barrel paths and reconcile updates |

Import `@nessalabs/ui/styles.css` for the library's component styles without a global reset. `theme.css` supplies tokens; `app.css` opts into the application-wide preflight/base layer. Choose deliberately when embedding in an existing page. The [repository README](../../README.md) owns installation examples and the [design-system contract](../architecture/design-system-contract.md) defines token and distribution requirements.

The parser's npm main build comes from `contract.ts`, while its copied-source `src/index.ts` reexports both contract and transcript. Moving a copied barrel can break a registry consumer even when the npm exports map still works. Registry items describe dependencies such as the shared size observer; copying a single component file by hand can omit those owners.

For contributors, use pinned pnpm 11.9.0 and the frozen lockfile. A release publishes the parser before UI with pnpm so `workspace:*` becomes a real dependency version. This atlas does not publish either package or claim to have installed the registry into an external project. Source checks, distribution checks and browser interaction checks are separate evidence.
