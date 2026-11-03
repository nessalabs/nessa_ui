---
id: "ui-tools"
title: "Agent work and questions"
kind: "contract"
status: "implemented"
summary: "ToolCall and ToolTrace display input, output and status supplied by a host. ToolTrace can show a waterfall and select one call's detail; it does not infer process state from how long a row has been visible."
parent: "ui-chat"
sources:
  [
    "packages/react/src/components/tool-call.tsx",
    "packages/react/src/components/tool-trace.tsx",
    "packages/react/src/components/agent-activity.tsx",
    "packages/react/src/components/agent-details.tsx",
    "packages/react/src/components/agent-notification.tsx",
    "packages/react/src/components/json-tree.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Explain agent work and questions

ToolCall and ToolTrace display input, output and status supplied by a host. ToolTrace can show a waterfall and select one call's detail; it does not infer process state from how long a row has been visible.

ToolTrace distinguishes pending/running from completed/failed/stopped. The host must mark stopped when a turn ends under an unfinished call. ToolCall and AgentActivity use their own simpler running/complete/error presentation vocabulary. Map those states deliberately instead of assuming the strings are interchangeable.

AgentDetails shows project, runtime, model and timestamps already known by the host. AgentNotification shows supplied connection state. AgentCard and AgentFigure identify an agent visually. JsonTree recursively displays arrays/plain objects and renders richer instances as leaves. FileDiffList and lazily loaded diff surfaces display supplied changes; neither executes a tool or checks the filesystem.

A request for permission is a separate interaction from a tool result. Use [approval](approvals.md) for the decision and [transcript correlation](../streams/transcript.md) to connect call IDs to results. An unanswered tool may remain pending while live or be marked abandoned when the host knows the run stopped; the visual library cannot make that external observation for you.
