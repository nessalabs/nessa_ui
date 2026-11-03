---
id: "ui-workspace"
title: "Workspace surfaces"
kind: "service"
status: "implemented"
summary: "Choose [layout and panels](layout.md) for an app frame, [window decks](windows.md) for switching among views, [boards](boards.md) for moving cards or connecting nodes, [schedules](schedules.md) for dates and dependencies, [tables and lists](tables.md) for rows, or [charts](charts.md) for data."
parent: "nessa-ui"
sources: ["packages/react/src/index.ts"]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Arrange and explore work

Choose [layout and panels](layout.md) for an app frame, [window decks](windows.md) for switching among views, [boards](boards.md) for moving cards or connecting nodes, [schedules](schedules.md) for dates and dependencies, [tables and lists](tables.md) for rows, or [charts](charts.md) for data.

These surfaces can retain local selection or gesture state, but they do not supply a database. In controlled mode, callbacks propose the next value and the host renders it back. Uncontrolled state lasts for the component's lifetime unless the host saves it elsewhere.
