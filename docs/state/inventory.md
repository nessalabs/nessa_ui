---
id: "ui-inventory"
title: "Feature ownership"
kind: "guide"
status: "implemented"
summary: "The React package barrel is the inventory boundary: each local public module below has an owning explanation and declaration link. Compound parts and types stay with their exported family, avoiding a separate page for every slot. Parser and transcript star exports are mapped separately below."
parent: "nessa-ui"
sources:
  [
    "packages/react/src/index.ts",
    "packages/agent-stream/src/contract.ts",
    "packages/agent-stream/src/transcript/index.ts",
    "registry.json",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Find every public feature owner

The React package barrel is the inventory boundary: each local public module below has an owning explanation and declaration link. Compound parts and types stay with their exported family, avoiding a separate page for every slot. Parser and transcript star exports are mapped separately below.

These are reusable library APIs, not evidence that a single application wires every widget together. The Storybook workspace contains examples and interaction tests. Host data sources, process management, permissions and persistence are external. Models apply only to the five selected owners explicitly linked from their lifecycle pages; other families have source contracts and the evidence described in Verification.

| Public module                              | Explanation                                  | Exact source owner                                                                   |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `components/activity-rings`                | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/activity-rings/index.ts)           |
| `components/avatar-stack`                  | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/avatar-stack.tsx)                  |
| `components/badge`                         | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/badge.tsx)                         |
| `components/breadcrumb`                    | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/components/breadcrumb.tsx)                    |
| `components/button`                        | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/button.tsx)                        |
| `components/card`                          | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/card.tsx)                          |
| `components/delta`                         | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/delta.tsx)                         |
| `components/meter`                         | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/meter.tsx)                         |
| `components/stat`                          | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/stat.tsx)                          |
| `components/status-label`                  | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/status-label.tsx)                  |
| `components/checkbox`                      | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/checkbox.tsx)                      |
| `components/empty-state`                   | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/empty-state.tsx)                   |
| `components/switch`                        | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/switch.tsx)                        |
| `components/kbd`                           | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/kbd.tsx)                           |
| `components/tooltip`                       | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/tooltip.tsx)                       |
| `components/search-field`                  | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/search-field.tsx)                  |
| `components/group-header`                  | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/group-header.tsx)                  |
| `components/settings-group`                | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/settings-group.tsx)                |
| `components/choices`                       | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/choices.tsx)                       |
| `components/checkbox-list`                 | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/checkbox-list.tsx)                 |
| `components/device-figure`                 | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/device-figure.tsx)                 |
| `components/key-fingerprint`               | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/key-fingerprint.tsx)               |
| `components/pairing-code`                  | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/pairing-code.tsx)                  |
| `components/qr-orb`                        | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/qr-orb.tsx)                        |
| `components/signal-orb`                    | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/signal-orb.tsx)                    |
| `lib/orb-code`                             | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/lib/orb-code.ts)                              |
| `components/conversation-rail`             | [history](services/chat/history.md)          | [Declaration](../../packages/react/src/components/conversation-rail.tsx)             |
| `components/drawer`                        | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/drawer.tsx)                        |
| `components/dialog`                        | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/dialog.tsx)                        |
| `components/dropdown-menu`                 | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/dropdown-menu.tsx)                 |
| `components/event-calendar`                | [schedules](services/workspace/schedules.md) | [Declaration](../../packages/react/src/components/event-calendar.tsx)                |
| `components/gantt-chart`                   | [schedules](services/workspace/schedules.md) | [Declaration](../../packages/react/src/components/gantt-chart/index.ts)              |
| `components/input`                         | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/input.tsx)                         |
| `components/page-outline`                  | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/components/page-outline.tsx)                  |
| `components/pagination`                    | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/components/pagination.tsx)                    |
| `components/timeline-header`               | [schedules](services/workspace/schedules.md) | [Declaration](../../packages/react/src/components/timeline-header.tsx)               |
| `components/tabs`                          | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/tabs.tsx)                          |
| `components/segmented-control`             | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/segmented-control.tsx)             |
| `components/price-chart`                   | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/price-chart/index.ts)              |
| `components/stock-quote`                   | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/stock-quote.tsx)                   |
| `components/popover-surface`               | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/popover-surface.tsx)               |
| `components/context-menu`                  | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/context-menu.tsx)                  |
| `components/kanban`                        | [boards](services/workspace/boards.md)       | [Declaration](../../packages/react/src/components/kanban/index.ts)                   |
| `components/code-block`                    | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/code-block.tsx)                    |
| `components/math-block`                    | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/math-block.tsx)                    |
| `components/loading-text`                  | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/loading-text.tsx)                  |
| `components/favicon`                       | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/favicon.tsx)                       |
| `components/generating-surface`            | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/generating-surface.tsx)            |
| `components/transcript-divider`            | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/transcript-divider.tsx)            |
| `components/gradient-surface`              | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/gradient-surface.tsx)              |
| `components/agent-figure/agent-figure`     | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/agent-figure/agent-figure.tsx)     |
| `components/bloom-field`                   | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/bloom-field.tsx)                   |
| `components/gradient-text`                 | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/gradient-text.tsx)                 |
| `components/type-in`                       | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/type-in.tsx)                       |
| `components/step-dots`                     | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/step-dots.tsx)                     |
| `components/agent-card`                    | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/agent-card.tsx)                    |
| `components/morphing-mesh-gradient`        | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/morphing-mesh-gradient.tsx)        |
| `components/mermaid-diagram`               | [mermaid](services/chat/mermaid.md)          | [Declaration](../../packages/react/src/components/mermaid-diagram.tsx)               |
| `components/message`                       | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/message.tsx)                       |
| `components/message-actions`               | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/message-actions/index.ts)          |
| `components/message-markdown`              | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/message-markdown.tsx)              |
| `components/message-scroller`              | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/message-scroller.tsx)              |
| `components/selection-tooltip`             | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/selection-tooltip.tsx)             |
| `components/searchable-listbox`            | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/searchable-listbox.tsx)            |
| `components/sectioned-listbox`             | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/sectioned-listbox.tsx)             |
| `components/model-picker`                  | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/model-picker.tsx)                  |
| `components/model-capabilities`            | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/model-capabilities.ts)             |
| `components/model-capability-controls`     | [inputs](services/interface/inputs.md)       | [Declaration](../../packages/react/src/components/model-capability-controls.tsx)     |
| `components/chat-composer`                 | [composer](services/chat/composer.md)        | [Declaration](../../packages/react/src/components/chat-composer.tsx)                 |
| `components/chat-composer-editor`          | [composer](services/chat/composer.md)        | [Declaration](../../packages/react/src/components/chat-composer-editor.tsx)          |
| `components/chat-bubbles`                  | [messages](services/chat/messages.md)        | [Declaration](../../packages/react/src/components/chat-bubbles.tsx)                  |
| `components/undo-card`                     | [history](services/chat/history.md)          | [Declaration](../../packages/react/src/components/undo-card.tsx)                     |
| `components/chat-tabs`                     | [history](services/chat/history.md)          | [Declaration](../../packages/react/src/components/chat-tabs.tsx)                     |
| `components/chat-overlay`                  | [overlay](services/chat/overlays.md)         | [Declaration](../../packages/react/src/components/chat-overlay.tsx)                  |
| `components/chat-annotations`              | [overlay](services/chat/overlays.md)         | [Declaration](../../packages/react/src/components/chat-annotations.tsx)              |
| `components/chat-tray`                     | [overlay](services/chat/overlays.md)         | [Declaration](../../packages/react/src/components/chat-tray.tsx)                     |
| `components/pill-composer`                 | [composer](services/chat/composer.md)        | [Declaration](../../packages/react/src/components/pill-composer.tsx)                 |
| `components/agent-notification`            | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/agent-notification.tsx)            |
| `components/file-diff-list`                | [code](services/content/code.md)             | [Declaration](../../packages/react/src/components/file-diff-list.tsx)                |
| `components/file-drop-zone`                | [composer](services/chat/composer.md)        | [Declaration](../../packages/react/src/components/file-drop-zone.tsx)                |
| `components/composer-queue`                | [queue](services/chat/queue.md)              | [Declaration](../../packages/react/src/components/composer-queue.tsx)                |
| `components/composer-access-mode`          | [queue](services/chat/queue.md)              | [Declaration](../../packages/react/src/components/composer-access-mode.tsx)          |
| `components/sheet`                         | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/components/sheet.tsx)                         |
| `components/agent-activity`                | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/agent-activity.tsx)                |
| `components/agent-details`                 | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/agent-details.tsx)                 |
| `components/conversation-history`          | [history](services/chat/history.md)          | [Declaration](../../packages/react/src/components/conversation-history.tsx)          |
| `components/swipe-row`                     | [history](services/chat/history.md)          | [Declaration](../../packages/react/src/components/swipe-row.tsx)                     |
| `components/tool-call`                     | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/tool-call.tsx)                     |
| `components/tool-trace`                    | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/tool-trace.tsx)                    |
| `components/json-tree`                     | [tools](services/chat/tools.md)              | [Declaration](../../packages/react/src/components/json-tree.tsx)                     |
| `components/tool-approval`                 | [approval](services/chat/approvals.md)       | [Declaration](../../packages/react/src/components/tool-approval.tsx)                 |
| `components/sidebar`                       | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/components/sidebar.tsx)                       |
| `components/reference`                     | [overlay](services/chat/overlays.md)         | [Declaration](../../packages/react/src/components/reference.tsx)                     |
| `components/questionnaire`                 | [approval](services/chat/approvals.md)       | [Declaration](../../packages/react/src/components/questionnaire.tsx)                 |
| `components/split-view`                    | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/components/split-view/index.ts)               |
| `components/table`                         | [tables](services/workspace/tables.md)       | [Declaration](../../packages/react/src/components/table/index.ts)                    |
| `components/task-list`                     | [schedules](services/workspace/schedules.md) | [Declaration](../../packages/react/src/components/task-list.tsx)                     |
| `composites/app-shell`                     | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/composites/app-shell/index.ts)                |
| `lib/app-shell-layout`                     | [layout](services/workspace/layout.md)       | [Declaration](../../packages/react/src/lib/app-shell-layout/index.ts)                |
| `components/workflow-canvas`               | [boards](services/workspace/boards.md)       | [Declaration](../../packages/react/src/components/workflow-canvas/index.ts)          |
| `components/random-avatar`                 | [identity](services/content/identity.md)     | [Declaration](../../packages/react/src/components/random-avatar.tsx)                 |
| `components/flow-chart`                    | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/flow-chart/index.ts)               |
| `components/radar-chart`                   | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/radar-chart/index.ts)              |
| `components/pie-chart`                     | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/pie-chart/index.ts)                |
| `lib/chart-geometry`                       | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/lib/chart-geometry.ts)                        |
| `components/sparkline`                     | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/sparkline.tsx)                     |
| `components/chart-tooltip`                 | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/chart-tooltip.tsx)                 |
| `components/proportion-bar`                | [charts](services/workspace/charts.md)       | [Declaration](../../packages/react/src/components/proportion-bar.tsx)                |
| `components/file-preview`                  | [preview](services/content/previews.md)      | [Declaration](../../packages/react/src/components/file-preview/index.ts)             |
| `components/window-deck`                   | [windows](services/workspace/windows.md)     | [Declaration](../../packages/react/src/components/window-deck/index.ts)              |
| `lib/portal-container`                     | [layers](services/interface/layers.md)       | [Declaration](../../packages/react/src/lib/portal-container.tsx)                     |
| `provider/nessa-color-mode`                | [theme](services/interface/theme.md)         | [Declaration](../../packages/react/src/provider/nessa-color-mode.ts)                 |
| `provider/nessa-provider`                  | [theme](services/interface/theme.md)         | [Declaration](../../packages/react/src/provider/nessa-provider.tsx)                  |
| `provider/nessa-scope`                     | [theme](services/interface/theme.md)         | [Declaration](../../packages/react/src/provider/nessa-scope.tsx)                     |
| `theme/nessa-theme-scope`                  | [theme](services/interface/theme.md)         | [Declaration](../../packages/react/src/theme/nessa-theme-scope.tsx)                  |
| `lib/utils`                                | [theme](services/interface/theme.md)         | [Declaration](../../packages/react/src/lib/utils.ts)                                 |
| `components/virtual-list`                  | [tables](services/workspace/tables.md)       | [Declaration](../../packages/react/src/components/virtual-list.tsx)                  |
| `components/git-history`                   | [code](services/content/code.md)             | [Declaration](../../packages/react/src/components/git-history/index.tsx)             |
| `components/git-commit-details`            | [code](services/content/code.md)             | [Declaration](../../packages/react/src/components/git-commit-details.tsx)            |
| `components/chat-composer-markdown-editor` | [composer](services/chat/composer.md)        | [Declaration](../../packages/react/src/components/chat-composer-markdown-editor.tsx) |
| `components/code-editor`                   | [code](services/content/code.md)             | [Declaration](../../packages/react/src/components/code-editor.tsx)                   |

`@nessalabs/agent-stream` exports the normalized event contract, JSON readers, EventSink, transport descriptors, six provider namespaces and flat mapper helpers: see [mapping](services/streams/mapping.md). Its `./transcript` entry exports the fold and incremental builder: see [transcript](services/streams/transcript.md). The React barrel reexports both. The parser's registry barrel includes both whereas npm keeps two entrypoints.

Supporting owners such as size-observer, MermaidRenderQueue, useFileText and portal/focus helpers are mapped through their consumer pages. CSS tokens, registry manifests and package export maps belong to [distribution](distribution.md). Pure geometry/value helpers remain contract pages. Detailed per-prop declarations and Storybook remain the source API reference; this atlas explains observable outcomes, ownership and lifetime boundaries.
