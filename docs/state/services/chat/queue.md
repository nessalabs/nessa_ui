---
id: "ui-queue"
title: "Pending messages"
kind: "contract"
status: "implemented"
summary: "ComposerQueue displays the pending item IDs supplied by the host. Dragging or keyboard sorting proposes a new order through `onReorder`; there is no built-in sender, durable outbox or automatic drain."
parent: "ui-chat"
sources:
  [
    "packages/react/src/components/composer-queue.tsx",
    "packages/react/src/components/composer-access-mode.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Present pending messages

ComposerQueue displays the pending item IDs supplied by the host. Dragging or keyboard sorting proposes a new order through `onReorder`; there is no built-in sender, durable outbox or automatic drain.

For example, dragging the third row onto the first reports an array with the moved ID. The host must accept it into state and decide whether that order can still change while a message is being sent. A drop outside a valid row, onto itself, or with an ID absent from the current list produces no reorder. Pointer sorting activates after a small movement and stays on the vertical axis within the list.

ComposerQueueItem exposes separate promote, steer, remove and more callbacks. Promote means move toward the front; steer is a host action directed at the current run. Providing a button does not establish that the connected transport supports steering. ComposerDeliveryMode reports queue/steer selection. ComposerQueueBadge hides at zero and delegates opening the list to its host.

Closing the queue view only removes UI. Whether a pending or submitted message survives depends on the application owner, which is outside this repository. ComposerAccessMode likewise selects a host-owned access policy; it does not grant permissions to an agent. An integration must reconcile backend acceptance and failures before presenting a delivered or authorized state.
