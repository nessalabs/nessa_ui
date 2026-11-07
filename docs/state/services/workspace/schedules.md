---
id: "ui-schedules"
title: "Dates and tasks"
kind: "contract"
status: "implemented"
summary: "GanttChart, EventCalendar and TaskList display supplied work on a timeline, calendar or list. The host chooses the real tasks and the persistence policy."
parent: "ui-workspace"
sources:
  [
    "packages/react/src/components/gantt-chart/gantt-chart.tsx",
    "packages/react/src/components/gantt-chart/gantt-chart-scheduling.ts",
    "packages/react/src/components/event-calendar.tsx",
    "packages/react/src/components/timeline-header.tsx",
    "packages/react/src/components/task-list.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Edit dates and planned work

GanttChart, EventCalendar and TaskList display supplied work on a timeline, calendar or list. The host chooses the real tasks and the persistence policy.

GanttChart can own an initial task array locally or consume a controlled one. Moving/resizing a task proposes new dates; `confirmMoves` defaults true so the built-in confirmation appears before commit. Dependency cascade is off by default, leaving arrows visual. When enabled, the move can carry dependent tasks according to the predecessor edge that changed; confirmation can choose moving all or only the selected task. The host still decides whether and how to save the result.

The chart supports timeline scale, selected task, collapsed summaries, task-list width, localized labels, shortcuts and a current-date marker. A fixed `now` makes the marker deterministic; otherwise it tracks the real clock. Dependency helpers detect cycles and violations and compute critical tasks. Their executed unit tests check scheduling rules, not a calendar server or timezone integration in a consuming app.

EventCalendar exposes scheduled entries and event gestures; it does not book meetings or send invitations. TimelineHeader is reusable horizontal scale chrome, not a scheduler. TaskList lets people toggle todo/done; active/failed represent agent-owned facts and render read-only. A task becoming visually done does not prove a remote action completed.
