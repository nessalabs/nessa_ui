---
id: "ui-streams"
title: "Agent event streams"
kind: "service"
status: "implemented"
summary: "The agent-stream package normalizes provider records so a host can draw one conversation UI. It does not start providers, open sockets, send approvals or persist a session."
parent: "nessa-ui"
sources:
  [
    "packages/agent-stream/src/contract.ts",
    "packages/agent-stream/src/transports.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Read an agent event stream

The agent-stream package normalizes provider records so a host can draw one conversation UI. It does not start providers, open sockets, send approvals or persist a session.

Choose [the matching transport and mapper](mapping.md), preserve ordering and identity, then use [the transcript fold](transcript.md) if you want turns, grouped tools and delegated runs. The host must still tell the fold whether work is alive. Silence on a stream is not proof that a process exited.
