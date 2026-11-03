---
id: "ui-chat"
title: "Conversation surfaces"
kind: "service"
status: "implemented"
summary: "Use [composer and attachment controls](composer.md) to collect input, [queue controls](queue.md) to expose host-owned pending work, and [messages](messages.md) to present a transcript. [Approvals](approvals.md) and [tool displays](tools.md) show agent facts supplied by the host."
parent: "nessa-ui"
sources:
  [
    "packages/react/src/components/chat-composer.tsx",
    "packages/react/src/components/message.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Build a conversation surface

Use [composer and attachment controls](composer.md) to collect input, [queue controls](queue.md) to expose host-owned pending work, and [messages](messages.md) to present a transcript. [Approvals](approvals.md) and [tool displays](tools.md) show agent facts supplied by the host.

[History and tabs](history.md) choose which conversation to show. [Reading overlays](overlays.md) keep the surrounding chat usable. [Mermaid rendering](mermaid.md) owns a separate shared queue because diagrams change library-global configuration. None of these UI owners implements remote message delivery.
