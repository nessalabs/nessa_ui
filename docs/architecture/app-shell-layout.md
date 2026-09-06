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

## Pane presentation

The workspace renders panes as **tiles** by default: each pane is a rounded,
outlined, filled card, with `paneGap` of space between neighbours and the
same gap inset around the region. A tile reads as its own surface, which is
what makes the grabber and the drag-to-swap affordance legible — space
around a thing is what says the thing can move.

The outline is a `ring`, not a `border`. A border occupies layout, and
maximize renders the panes it hides at exactly zero extent — a bordered
pane would still measure two pixels wide, so "every other pane collapses to
nothing" would quietly stop being true. A ring is painted as a shadow and
takes no space. It also composes: the active pane's ring simply recolours
the tile's own.

The gap is not CSS `gap`. The separator between two panes *becomes* the gap:
transparent, and exactly `paneGap` wide. This matters because
`measureGroupSize` sums the panels' own extents rather than the container's
(separators excluded by construction), so widening a separator changes
nothing in the resize mathematics — percentages stay exact and
`split-view-math.ts` needs no notion of spacing at all. It also means the
whole visible gap is the resize target, not a 1px line with an invisible
hit strip around it.

`paneStyle="flush"` restores the older presentation: panes butted together
with one hairline separator between them, for shells that want the region
to read as a single continuous surface.

## Dragging panes

Set `paneGrabber` to render an `AppShellPaneGrabber` on each pane's top
edge: a short pill that appears when its pointer target is hovered. It is
**off by default**, so existing pane content keeps receiving pointer input.
Opt in only when the top-centre 80 by 20 CSS pixels are reserved for this
overlay: its target receives pointer events even while the pill is hidden.
Hosts with their own pane chrome can place an `AppShellPaneDragHandle`
there instead. Both use the same drag mechanism. The grabber is hidden
from assistive technology because it is pointer-only; hosts must provide
keyboard-accessible layout actions for equivalent operations.

`AppShellPaneDragHandle` makes part of a pane's chrome draggable, and
dragging does exactly one thing: swap two panes. Picking a pane up lifts it
out — its content turns invisible in place (still mounted, so its state
survives), the emptied slot shows a dashed outline, and a faded miniature
of the pane follows the cursor as the drag ghost.

Hovering another pane previews the exchange as *motion*, not as a
cross-fade. Both slots stand empty — the hole the drag opened and the one
about to be landed in — and the hovered pane's content leaves on a single
absolutely-positioned layer (`app-shell-displaced-pane`) that starts on top
of that pane and glides into the emptied source slot, translating and
scaling to its size. The layer is keyed on the target pane, so moving to a
different pane remounts it and replays the journey from that pane's own
position. Two things blinking read as a redraw; one thing travelling reads
as a swap, which is what is actually about to happen.

Releasing applies `swapPanes`, which exchanges the two panes without
touching any split or orientation, and both panes glide to their new
positions with a short transform animation (skipped under
prefers-reduced-motion, as is the displacement glide). Panes not involved fade slightly so the source and
target stand out, and Escape cancels. New sections are never created by
dragging — they come from the explicit split actions — though the model's
`movePane` operation remains available to applications that want edge-drop
behavior. Dragging uses plain pointer events — no drag-and-drop library —
and is a pointer-only affordance; keyboard users reach the same layouts
through the split and close actions.

## Nesting in a WindowDeck

A `WindowDeckPane` may host an `AppShellWorkspace`, giving a deck of windows
where each window is its own split workspace. The two systems own different
things and never contend: the deck moves *whole windows* by transform, the
shell tiles *within one* by flex weights.

The join between them is a gesture boundary. The deck starts a drag on any
pointer down inside a pane — a throw routinely leaves the tile it started
on, so the gesture is tracked on `window` rather than the pane. A split
separator and a pane drag handle run pointer drags of their own, and both
would otherwise also throw the window away.

So a control that owns its own pointer drag marks itself
`data-deck-gesture="ignore"`, and `WindowDeckPane` walks up from the event
target to its own element and stands down when it finds one. The walk is
bounded by the pane, so an opt-out outside this deck can never silence it.
The attribute is inert when no deck is present, which is why neither
component imports the other.

Two things the host still has to choose:

- **`contentMount="always"`.** The default (`"active"`) mounts only the live
  window. The layout document is serializable, so split *structure* survives
  a remount if the host persists from `onLayoutCommit` — but view state
  inside panes (scroll offsets, editor buffers, running work) does not.
- **A `preview` on each pane.** Overview tiles are scaled, and
  `getBoundingClientRect` reports transformed rectangles, so a separator
  drag on a scaled-down tile would compute against the shrunken box. A
  preview keeps a live workspace out of the overview entirely; panes can
  also read `mode` from `useWindowDeck()` and go inert.

Keyboard bindings do not collide: the deck defaults to Mod+G and Mod+Arrow,
the shell to Shift+Escape.

## Accessibility

Every separator — SplitView and dock — implements the ARIA window-splitter
pattern: `role="separator"`, an accessible name, `aria-controls`,
`aria-valuenow/min/max`, focusability, and keyboard resizing (arrows, Home,
End, and Enter to toggle collapse where applicable).
