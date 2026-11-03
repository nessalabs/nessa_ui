---
id: "ui-history"
title: "History and tabs"
kind: "contract"
status: "implemented"
summary: "ConversationHistory renders host-owned conversations, query and actions. Selecting a row reports the identity to the host. Searching this view is not a repository-wide server search unless the application implements that behind its query callback."
parent: "ui-chat"
sources:
  [
    "packages/react/src/components/conversation-history.tsx",
    "packages/react/src/components/conversation-history-swipe.ts",
    "packages/react/src/components/swipe-row.tsx",
    "packages/react/src/components/undo-card.tsx",
    "packages/react/src/components/conversation-rail.tsx",
    "packages/react/src/components/chat-tabs.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Choose and act on a conversation

ConversationHistory renders host-owned conversations, query and actions. Selecting a row reports the identity to the host. Searching this view is not a repository-wide server search unless the application implements that behind its query callback.

SwipeRow supplies reveal and confirmation interaction, and ConversationHistory composes row actions. A confirming second press is local UI confirmation; the host must still apply archive/delete and handle a failure. UndoCard offers an undo callback for an outcome the host supplies. It does not retain a deleted record or implement transactional rollback.

ConversationRail provides a compact route among items. ChatTabs can hold conversations, subagent views, documents and history. A child tab may name its parent: reselecting the active child can report the parent ID, giving a route back. Closing a tab calls the host's close action; it does not stop an agent or erase conversation history.

Keep selected conversation and durable edits above virtualized/unmounted rows. Stable IDs connect a row's actions to the right host record. Read [tables and virtual lists](../workspace/tables.md) before depending on every row remaining mounted or browser Find discovering hidden rows.
