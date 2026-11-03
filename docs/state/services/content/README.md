---
id: "ui-content"
title: "Content surfaces"
kind: "service"
status: "implemented"
summary: "Use [file previews](previews.md) to display a URL or Blob, [code and Git views](code.md) to inspect supplied text and history, and [identity and pairing visuals](identity.md) to display a device or agent."
parent: "nessa-ui"
sources:
  [
    "packages/react/src/components/file-preview/index.ts",
    "packages/react/src/components/pairing-code.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Show files code and visual identity

Use [file previews](previews.md) to display a URL or Blob, [code and Git views](code.md) to inspect supplied text and history, and [identity and pairing visuals](identity.md) to display a device or agent.

File kind detection does not guarantee that the browser can decode the file. A visible pairing code does not establish a network link. The host owns those external effects and the UI exposes their supplied state.
