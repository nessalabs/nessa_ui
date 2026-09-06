"use client"

/** @responsibility Renders the recursive workspace tree as nested SplitViews and routes pane focus and resizes back to the layout document. */

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  SplitView,
  SplitViewPanel,
  SplitViewSeparator,
  type SplitViewLayout,
  type SplitViewSize,
} from "@/components/split-view"
import {
  PaneDropRegion,
  SplitOrientation,
  findNode,
  setSplitWeights,
  focusPane,
  type LayoutNode,
  type LayoutNodeId,
  type PaneNode,
  type SplitNode,
} from "@/lib/app-shell-layout"

import { useAppShellContext } from "./app-shell"
import {
  AppShellDragProvider,
  AppShellPaneGrabber,
  useAppShellDrag,
} from "./app-shell-drag"

/** How the workspace presents its panes. */
type AppShellPaneStyle = "tiled" | "flush"

/**
 * The space between tiles when the host does not choose one. Small enough
 * that the workspace still reads as one region, large enough that each tile
 * reads as its own surface.
 */
const DEFAULT_PANE_GAP = "0.375rem"

/** Properties accepted by the workspace region. */
interface AppShellWorkspaceProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * Renders the content of one pane. Receives the pane node; resolve its
   * views to application content here. The layout document never holds
   * elements, so panes stay serializable.
   */
  renderPane: (pane: PaneNode) => React.ReactNode
  /**
   * Smallest size of every workspace pane: a percentage number, "Npx", or
   * "N%".
   * @defaultValue "96px"
   */
  minPaneSize?: SplitViewSize
  /**
   * Accessible name of every separator between workspace panes. Override it
   * to localize or reword what screen readers announce.
   * @defaultValue "Resize workspace panes"
   */
  separatorLabel?: string
  /**
   * How panes are presented. `tiled` stands every pane on its own rounded,
   * outlined card with space between them and around the region, which is
   * what makes a pane read as a movable thing. `flush` butts panes against
   * each other and draws one hairline between them, for shells that want
   * the region to read as a single continuous surface.
   * @defaultValue "tiled"
   */
  paneStyle?: AppShellPaneStyle
  /**
   * Space between tiles, and between the tiles and the region's edge, as a
   * CSS length. Ignored when `paneStyle` is `flush`. It also sets the
   * separator's grab width, so a larger gap is a larger resize target.
   * @defaultValue "0.375rem"
   */
  paneGap?: string
  /**
   * Whether each pane renders the default grabber on its top edge. Turn it
   * off when the pane's own chrome hosts an `AppShellPaneDragHandle`.
   * @defaultValue true
   */
  paneGrabber?: boolean
}

/**
 * Renders one workspace pane shell with focus tracking.
 *
 * @param props - The pane node, active state, and the pane renderer.
 * @returns The pane container hosting application content.
 */
function WorkspacePane({
  pane,
  active,
  renderPane,
  tiled,
  grabber,
}: {
  pane: PaneNode
  active: boolean
  renderPane: AppShellWorkspaceProps["renderPane"]
  tiled: boolean
  grabber: boolean
}) {
  const { updateLayout } = useAppShellContext()
  const { draggingPaneId, dropTarget } = useAppShellDrag()

  /** Promotes this pane to the active pane when interaction enters it. */
  const activate = () => {
    if (!active) {
      updateLayout((current) => focusPane(current, { paneId: pane.id }), {
        operation: "focus",
        phase: "settled",
      })
    }
  }

  const isDropTarget = dropTarget?.paneId === pane.id
  const isDragSource = draggingPaneId === pane.id
  // While a drag is running, panes not involved in it fade slightly so the
  // lifted source and the highlighted target stand out.
  const dimmed = draggingPaneId !== null && !isDragSource && !isDropTarget

  return (
    <div
      data-slot="app-shell-pane"
      data-pane-id={pane.id}
      data-active={active || undefined}
      data-drag-source={isDragSource || undefined}
      data-drag-dimmed={dimmed || undefined}
      className={cn(
        "relative flex h-full min-h-0 min-w-0 flex-1 flex-col",
        "overflow-hidden transition-opacity",
        // A tile is its own surface: rounded, outlined, and filled, so the
        // space around it reads as space rather than as a seam. The outline
        // is a ring, not a border: a border occupies layout, and a pane
        // collapsed to zero by maximize must measure exactly zero. It also
        // means the active ring below simply recolours this one.
        tiled && "rounded-lg bg-background ring-1 ring-border ring-inset",
        "data-active:ring-1 data-active:ring-inset data-active:ring-ring/40",
        "data-drag-dimmed:opacity-75",
      )}
      onFocusCapture={activate}
      onPointerDownCapture={activate}
    >
      {/* While this pane is being dragged, its content lifts out — mounted
          (state survives) but invisible, with the emptied slot shown below.
          While this pane is hovered as the drop target, the swap preview's
          scrim fades it visually. */}
      <div
        data-slot="app-shell-pane-content"
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col",
          isDragSource && "invisible",
        )}
      >
        {renderPane(pane)}
      </div>
      {isDragSource ? (
        // The hole this pane was lifted out of. It stays an empty spot: the
        // displaced pane's content travels into it on its own layer, so the
        // slot must not also draw a copy of what is arriving.
        <div
          aria-hidden
          inert
          data-slot="app-shell-pane-lift"
          // Opaque, so nothing beneath can bleed through the empty slot.
          className="absolute inset-1 z-10 overflow-hidden rounded-md border-2 border-dashed border-ring/50 bg-muted"
        />
      ) : null}
      {isDropTarget ? (
        // The spot the dragged pane is about to land in. Its own content
        // has left — it is travelling to the hole the drag opened — so this
        // reads as a vacated slot, ringed to say the drop lands here. It is
        // opaque, so this pane's still-mounted content cannot bleed
        // through the hole its content just left.
        <div
          aria-hidden
          inert
          data-slot="app-shell-drop-preview"
          className="pointer-events-none absolute inset-1 z-20 overflow-hidden rounded-md border-2 border-dashed border-ring/50 bg-muted ring-2 ring-inset ring-ring/70"
        />
      ) : null}
      {grabber ? <AppShellPaneGrabber paneId={pane.id} /> : null}
    </div>
  )
}

/**
 * Renders one node of the workspace tree.
 *
 * Maximizing never removes anything. The other panes are simply rendered at
 * 0% width, so their content (scroll position, typed text, and so on) stays
 * alive and comes back untouched on restore:
 *
 * ```txt
 *   normal      │ A 30% │ B 40% │ C 30% │
 *   maximize B  │         B 100%        │   A and C still mounted, at 0%
 * ```
 *
 * The saved layout document is not touched either — the 100/0 sizes are
 * made up at render time from `maximizedPaneId`.
 *
 * @param props - The node, active and maximized pane ids, the pane
 * renderer, and the minimum pane size.
 * @returns The rendered subtree.
 */
function WorkspaceNode({
  node,
  activePaneId,
  maximizedPaneId,
  renderPane,
  minPaneSize,
  separatorLabel,
  tiled,
  grabber,
}: {
  node: LayoutNode
  activePaneId: LayoutNodeId
  maximizedPaneId: LayoutNodeId | undefined
  renderPane: AppShellWorkspaceProps["renderPane"]
  minPaneSize: SplitViewSize
  separatorLabel: string
  tiled: boolean
  grabber: boolean
}) {
  const { updateLayout } = useAppShellContext()

  if (node.type === "pane") {
    return (
      <WorkspacePane
        pane={node}
        active={node.id === activePaneId}
        renderPane={renderPane}
        tiled={tiled}
        grabber={grabber}
      />
    )
  }

  const split: SplitNode = node
  // The 100/0 sizing only applies to splits on the path to the maximized
  // pane. Splits inside hidden branches keep their normal proportions —
  // they are invisible anyway, and an all-zero layout would be unusable.
  const maximizing =
    maximizedPaneId !== undefined &&
    findNode(split, maximizedPaneId) !== undefined
  const layout: SplitViewLayout = {}

  for (const child of split.children) {
    layout[child.id] = maximizing
      ? findNode(child, maximizedPaneId) !== undefined
        ? 100
        : 0
      : child.weight * 100
  }

  /**
   * Writes a SplitView percentage layout back as sibling weights.
   *
   * @param next - The SplitView layout produced by an interaction.
   * @param phase - Whether the gesture is ongoing or settled.
   */
  const applyWeights = (next: SplitViewLayout, phase: "live" | "settled") => {
    if (maximizing) {
      return
    }

    updateLayout(
      (current) =>
        setSplitWeights(current, {
          splitId: split.id,
          weights: split.children.map(
            (child) => (next[child.id] ?? child.weight * 100) / 100,
          ),
        }),
      { operation: "pane-resize", phase },
    )
  }

  return (
    <SplitView
      orientation={split.orientation}
      layout={layout}
      onLayoutChange={(next) => applyWeights(next, "live")}
      onLayoutCommit={(next) => applyWeights(next, "settled")}
      className="h-full w-full"
    >
      {split.children.flatMap((child, index) => {
        const hiddenByMaximize = maximizing && layout[child.id] === 0

        const panel = (
          <SplitViewPanel
            key={child.id}
            id={child.id}
            minSize={maximizing ? 0 : minPaneSize}
            // Panes squeezed to zero width stay mounted (their content
            // state survives) but become inert: not tabbable and hidden
            // from screen readers until the workspace is restored.
            inert={hiddenByMaximize || undefined}
          >
            <WorkspaceNode
              node={child}
              activePaneId={activePaneId}
              maximizedPaneId={maximizedPaneId}
              renderPane={renderPane}
              minPaneSize={minPaneSize}
              separatorLabel={separatorLabel}
              tiled={tiled}
              grabber={grabber}
            />
          </SplitViewPanel>
        )

        if (index === 0) {
          return [panel]
        }

        return [
          <SplitViewSeparator
            key={`separator:${child.id}`}
            aria-label={separatorLabel}
            className={cn(
              // A tiled workspace draws no seam: the separator becomes the
              // gap itself — as wide as the space between two tiles, so the
              // whole gap is the grab target. The surface never fills,
              // because tinting the entire gap reads as a slab rather than
              // an edge. What appears instead is the same pill the pane
              // grabber uses, turned along the divider: one grip shape for
              // both "move this" and "resize this", so the two affordances
              // read as one family.
              tiled && [
                "bg-transparent hover:bg-transparent data-resizing:bg-transparent",
                "before:absolute before:top-1/2 before:left-1/2",
                "before:-translate-x-1/2 before:-translate-y-1/2",
                "before:rounded-full before:bg-transparent",
                "before:transition-colors",
                "hover:before:bg-muted-foreground/40",
                "data-resizing:before:bg-muted-foreground/60",
                split.orientation === SplitOrientation.Horizontal
                  ? "w-(--nessa-app-shell-pane-gap) before:h-7 before:w-1"
                  : "h-(--nessa-app-shell-pane-gap) before:h-1 before:w-7",
              ],
              maximizedPaneId !== undefined && "hidden",
            )}
          />,
          panel,
        ]
      })}
    </SplitView>
  )
}

/**
 * Renders the shell's recursive center region. Panes and splits come from
 * the shared layout document; a maximized pane temporarily fills the whole
 * region while the document — and every mounted pane — stays untouched.
 *
 * @param props - The pane renderer, minimum pane size, and native container
 * properties.
 * @returns The workspace region bound to the shell's layout document.
 */
function AppShellWorkspace({
  renderPane,
  minPaneSize = "96px",
  separatorLabel = "Resize workspace panes",
  paneStyle = "tiled",
  paneGap = DEFAULT_PANE_GAP,
  paneGrabber = true,
  className,
  style,
  ...props
}: AppShellWorkspaceProps) {
  const { layout } = useAppShellContext()
  const { workspace } = layout
  const workspaceRef = React.useRef<HTMLDivElement>(null)
  const tiled = paneStyle === "tiled"

  return (
    <div
      ref={workspaceRef}
      data-slot="app-shell-workspace"
      data-pane-style={paneStyle}
      data-maximized={workspace.maximizedPaneId !== undefined || undefined}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1",
        // The region is inset by the same gap that separates the tiles, so
        // a tile sits the same distance from its neighbour and from the
        // shell's edge.
        tiled && "p-(--nessa-app-shell-pane-gap)",
        className,
      )}
      style={
        tiled
          ? ({
              ...style,
              "--nessa-app-shell-pane-gap": paneGap,
            } as React.CSSProperties)
          : style
      }
      {...props}
    >
      <AppShellDragProvider workspaceRef={workspaceRef}>
        <WorkspaceNode
          node={workspace.root}
          activePaneId={workspace.activePaneId}
          maximizedPaneId={workspace.maximizedPaneId}
          renderPane={renderPane}
          minPaneSize={minPaneSize}
          separatorLabel={separatorLabel}
          tiled={tiled}
          grabber={paneGrabber}
        />
      </AppShellDragProvider>
    </div>
  )
}

export {
  AppShellWorkspace,
  type AppShellPaneStyle,
  type AppShellWorkspaceProps,
}
