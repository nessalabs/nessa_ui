# AppShell layout architecture

This document describes the layout system behind the `SplitView` primitives
and the `AppShell` composite, and the invariants that keep it sound.

## Two systems, not one

The shell deliberately separates two layout problems, following the
architecture shared by Zed, VS Code, and dockview:

1. **Docks** (`AppShellDock`) are fixed slots on the left, right, and bottom.
   Each is open or closed and sized in **pixels**. Docks never participate in
   splitting, and a dock keeps its pixel extent when the window resizes or
   while it is closed.
2. **The workspace** (`AppShellWorkspace`) is the only recursive region: an
   n-ary tree of splits whose leaves are panes. Sibling sizes are unitless
   **weights** that sum to 1, so saved layouts are display-independent.

## The layout document

`packages/react/src/lib/app-shell-layout/` defines one serializable,
JSON-safe document (`AppShellLayout`) and pure functions over it. Nothing in
the model imports React or touches the DOM.

- Every node — splits included — carries a stable `id`. Operations address
  nodes by id, never by position.
- Split orientation is explicit per node, never inferred from depth.
- Panes carry `views: PaneViewId[]` plus `activeViewId` even though the
  resize-only vertical renders a single view; a future tab strip is a
  renderer change, not a schema change.
- Focus (`activePaneId`), recency (`recentPaneIds`), and maximize
  (`maximizedPaneId`) are out-of-tree pointers, so they compose with every
  structural operation.
- The document stores no React elements and no minimum/maximum sizes;
  applications resolve views and declare constraints at render time.

### Invariants

`normalizeAppShellLayout` restores these after every operation and on any
deserialized document. It is idempotent.

- A split has at least two children; single-child splits collapse into their
  parent, inheriting the split's weight.
- No child split shares its parent's orientation; same-orientation nesting is
  flattened with weights scaled by the child's weight, preserving rendered
  geometry exactly.
- Sibling weights are non-negative and sum to 1 (a zero weight is a fully
  collapsed pane); invalid weights reset to an even distribution.
- Focus, recency, and maximize pointers always reference existing panes.

### Operations

`splitPane` implements the universal split rule (splitting along the parent
axis inserts a sibling; across it wraps the pane in a new split).
`removeNode` grants the removed node's weight to its adjacent sibling, which
makes `closePane` the geometric inverse of `splitPane`. `insertRelativeTo`
and `removeNode` are exported so a future drag-and-drop vertical can express
"move" as remove + insert without new schema.

## Ownership: library renders, application persists

Per the design-system contract, the components are stateless renderers of
the document. `AppShell` and `SplitView` accept controlled (`layout`) or
uncontrolled (`defaultLayout`) documents and report every change through a
two-phase event pair:

- `onLayoutChange` fires on each step, including every pointer move.
- `onLayoutCommit` fires once per settled operation, with provenance meta.

Applications persist from `onLayoutCommit` and feed the document back in.

## SplitView resize mathematics

`components/split-view/split-view-math.ts` adapts the percentage-based
resize algorithms of
[react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
at commit `f9c422714a66e14f671a17f340a3560d8032fcdc` (v4.12.3, MIT) — see
`THIRD_PARTY_NOTICES.md`. Key behaviors preserved from upstream:

- Drag deltas are absolute against a layout snapshot frozen at
  pointer-down, so clamped drags never drift.
- Constraint resolution cascades outward through neighbors.
- Collapsible panels snap across the halfway point for pointer input;
  keyboard input skips the halfway check so a small step can always expand.
- Separator ARIA bounds are computed by speculatively running the layout
  algorithm, reporting the sizes actually reachable.

The adaptation removes upstream's global mutable state (our components are
controlled), disabled panels, and non-px/% units. Unlike upstream, pointer
handling uses capture on the separator element itself — no document-level
capture-phase listeners — and horizontal resizing respects RTL.

## Dragging panes

`AppShellPaneDragHandle` makes part of a pane's chrome draggable, and
dragging does exactly one thing: swap two panes. Picking a pane up lifts it
out — its content turns invisible in place (still mounted, so its state
survives), the emptied slot shows a dashed outline, and a faded miniature
of the pane follows the cursor as the drag ghost. Hovering any other pane
highlights its whole surface and previews the incoming content faintly over
its own fading content; releasing applies `swapPanes`, which exchanges the
two panes without touching any split or orientation, and both panes glide
to their new positions with a short transform animation (skipped under
prefers-reduced-motion). Panes not involved fade slightly so the source and
target stand out, and Escape cancels. New sections are never created by
dragging — they come from the explicit split actions — though the model's
`movePane` operation remains available to applications that want edge-drop
behavior. Dragging uses plain pointer events — no drag-and-drop library —
and is a pointer-only affordance; keyboard users reach the same layouts
through the split and close actions.

## Accessibility

Every separator — SplitView and dock — implements the ARIA window-splitter
pattern: `role="separator"`, an accessible name, `aria-controls`,
`aria-valuenow/min/max`, focusability, and keyboard resizing (arrows, Home,
End, and Enter to toggle collapse where applicable).
