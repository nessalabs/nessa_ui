---
id: "ui-boards"
title: "Boards and connections"
kind: "contract"
status: "implemented"
summary: "Kanban and WorkflowCanvas turn pointer or keyboard gestures into changes a host can accept. Neither is a task database or a workflow execution engine."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/components/kanban/kanban.tsx",
    "packages/react/src/components/kanban/kanban-math.ts",
    "packages/react/src/components/workflow-canvas/workflow-canvas.tsx",
    "packages/react/src/components/workflow-canvas/workflow-canvas-math.ts",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Move cards and connect nodes

Kanban and WorkflowCanvas turn pointer or keyboard gestures into changes a host can accept. Neither is a task database or a workflow execution engine.

In Kanban, compose columns and cards with stable IDs. Lifting a card with Space/Enter begins keyboard movement; arrows choose a destination, Space drops and Escape cancels. The board reports a settled `onCardMove`, and the host renders the updated order. `applyKanbanMove` supplies the standard column-map transform. A cancellation leaves the original data ordering; a successful UI callback still needs the host's save/error policy. Column movement has its own callback and handle. Read-only mode refuses both pointer and keyboard moves.

WorkflowCanvas owns pan/zoom and connection gestures. A controlled viewport reports proposed values and waits for the host to render them back. `onConnect` reports two node endpoints; `onConnectEnd` can report a release over empty canvas so a host can open a creation palette. `onDismiss` lets the host close that transient UI. Reporting a connection does not execute an edge or create a server-side job.

Bounds and zoom limits constrain geometry. Read-only canvas disables node movement/deletion and connection handles but keeps viewing gestures, resizing and collapse controls. A nested canvas defaults to read-only as a preview. The pure geometry tests cover transforms and move math; live pointer capture, keyboard focus and a host's persistence remain different checks.
