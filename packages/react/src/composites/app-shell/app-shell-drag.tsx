"use client"

/** @responsibility Provides pointer-based pane dragging: shared drag state, nearest-edge drop targeting, and the drag handle. */

import * as React from "react"

import { cn } from "@/lib/utils"
import { swapPanes, type LayoutNodeId } from "@/lib/app-shell-layout"

import { useAppShellContext } from "./app-shell"

/**
 * The pane a drag is currently hovering. Dropping anywhere on a pane swaps
 * the two panes; new sections are created with the split actions instead.
 */
interface PaneDropTarget {
  paneId: LayoutNodeId
}

/** Shared state and callbacks for one workspace's drag interactions. */
interface AppShellDragContextValue {
  /** The pane currently being dragged, if any. */
  draggingPaneId: LayoutNodeId | null
  /** The pane and region the drag is hovering, if any. */
  dropTarget: PaneDropTarget | null
  /**
   * Starts a drag for one pane. A faded miniature of the pane follows the
   * cursor as the drag ghost. Returns false — and starts nothing — when
   * another drag is already in progress (for example a second finger).
   */
  startDrag: (paneId: LayoutNodeId) => boolean
  /** Updates the ghost position and drop target from the pointer. */
  moveDrag: (clientX: number, clientY: number) => void
  /** Ends the drag, applying the move or swap when `commit` is true. */
  endDrag: (commit: boolean) => void
}

const AppShellDragContext =
  React.createContext<AppShellDragContextValue | null>(null)

/**
 * Reads the drag state of the nearest workspace. Useful for custom pane
 * chrome that wants to react to an active drag.
 *
 * @returns The current drag context value.
 * @throws When called outside an AppShellWorkspace.
 */
function useAppShellDrag(): AppShellDragContextValue {
  const context = React.useContext(AppShellDragContext)

  if (!context) {
    throw new Error(
      "Pane drag components must be used within an AppShellWorkspace.",
    )
  }

  return context
}

/**
 * Cleanup ownership for glides still in flight, so a superseded animation
 * cannot clear the styles of a new glide on the same pane.
 */
const pendingGlideCleanups = new WeakMap<HTMLElement, () => void>()

/**
 * The transition both drag journeys use — the displaced pane travelling
 * into the emptied slot, and the two panes gliding to their new spots on
 * drop. The standard easing decelerates into the destination and stops
 * there: a pane arriving in a slot should settle, not bounce, so the
 * motion says "this moved" without drawing attention to itself.
 */
const PANE_TRAVEL_TRANSITION =
  "transform var(--nessa-motion-duration-normal) var(--nessa-motion-easing-standard)"

/**
 * Animates panes gliding from their previous spots to their new ones after
 * a drop (the classic first-last-invert-play technique): remember where a
 * pane was, let the layout move it, then start it back at the old spot and
 * let a transform transition carry it home. Skipped for people who prefer
 * reduced motion.
 *
 * @param workspace - The workspace element holding the panes.
 * @param paneIds - The panes about to move.
 */
function animatePaneMoves(
  workspace: HTMLElement,
  paneIds: readonly LayoutNodeId[],
) {
  if (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return
  }

  const before = new Map<string, DOMRect>()

  for (const pane of workspace.querySelectorAll<HTMLElement>(
    '[data-slot="app-shell-pane"]',
  )) {
    const id = pane.dataset.paneId

    if (id && paneIds.includes(id)) {
      before.set(id, pane.getBoundingClientRect())
    }
  }

  if (before.size === 0) return

  // Two frames so the layout change has definitely been painted into the
  // DOM before the new positions are measured.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const pane of workspace.querySelectorAll<HTMLElement>(
        '[data-slot="app-shell-pane"]',
      )) {
        const previous = pane.dataset.paneId
          ? before.get(pane.dataset.paneId)
          : undefined

        if (!previous) continue

        const next = pane.getBoundingClientRect()

        if (next.width === 0 || next.height === 0) continue

        const deltaX = previous.left - next.left
        const deltaY = previous.top - next.top
        const scaleX = previous.width / next.width
        const scaleY = previous.height / next.height

        if (
          Math.abs(deltaX) < 1 &&
          Math.abs(deltaY) < 1 &&
          Math.abs(scaleX - 1) < 0.01 &&
          Math.abs(scaleY - 1) < 0.01
        ) {
          continue
        }

        // Disown the previous glide before changing styles. Its canceled
        // animation may settle later and must not clear this glide.
        pendingGlideCleanups.get(pane)?.()

        pane.style.transformOrigin = "top left"
        pane.style.transition = "none"
        pane.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
        // Swapping panes cross each other mid-flight; lifting them above
        // their neighbors and making them slightly see-through keeps the
        // brief overlap readable instead of jarring.
        pane.style.zIndex = "30"
        pane.style.opacity = "0.9"
        void pane.offsetWidth // settle the starting position without animating

        const cancel = () => {
          pendingGlideCleanups.delete(pane)
        }

        const finish = () => {
          if (pendingGlideCleanups.get(pane) !== cancel) return
          cancel()
          pane.style.transition = ""
          pane.style.transform = ""
          pane.style.transformOrigin = ""
          pane.style.zIndex = ""
          pane.style.opacity = ""
        }

        pendingGlideCleanups.set(pane, cancel)
        pane.style.transition = PANE_TRAVEL_TRANSITION
        pane.style.transform = ""
        // Resolve the transition after the final style write. Completion
        // belongs to the animation timeline: even a duration-derived wall
        // timer can outrun rendering under load or when playback is slowed.
        const transitions = pane.getAnimations().filter(
          (animation) => animation instanceof CSSTransition &&
            animation.transitionProperty === "transform",
        )
        if (transitions.length === 0) {
          finish()
        } else {
          // Cancellation (including removal from the document) also releases
          // styles, unless a newer glide has already taken ownership.
          void Promise.all(transitions.map((animation) => animation.finished))
            .then(finish, finish)
        }
      }
    }),
  )
}

/**
 * Finds the pane under a pointer position. The whole pane is one drop
 * target — releasing anywhere on it swaps the two panes.
 *
 * @param workspace - The workspace element holding the panes.
 * @param draggingPaneId - The pane being dragged (never its own target).
 * @param clientX - The pointer's horizontal position.
 * @param clientY - The pointer's vertical position.
 * @returns The hovered pane, or null between panes.
 */
function findDropTarget(
  workspace: HTMLElement,
  draggingPaneId: LayoutNodeId,
  clientX: number,
  clientY: number,
): PaneDropTarget | null {
  const panes = workspace.querySelectorAll<HTMLElement>(
    '[data-slot="app-shell-pane"]',
  )

  for (const pane of panes) {
    const paneId = pane.dataset.paneId

    if (!paneId || paneId === draggingPaneId) continue

    const rect = pane.getBoundingClientRect()

    if (
      rect.width === 0 ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      continue
    }

    return { paneId }
  }

  return null
}

/**
 * Provides drag coordination for one workspace. Rendered by
 * AppShellWorkspace; applications never mount it directly.
 *
 * @param props - The workspace element ref and the workspace content.
 * @returns A context provider wiring drag state to the layout document.
 */
function AppShellDragProvider({
  workspaceRef,
  children,
}: {
  workspaceRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  const { updateLayout } = useAppShellContext()
  const [draggingPaneId, setDraggingPaneId] =
    React.useState<LayoutNodeId | null>(null)
  const [dropTarget, setDropTarget] = React.useState<PaneDropTarget | null>(
    null,
  )
  const draggingRef = React.useRef<LayoutNodeId | null>(null)
  const dropTargetRef = React.useRef<PaneDropTarget | null>(null)
  const ghostRef = React.useRef<HTMLDivElement | null>(null)
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null)

  /** Places the ghost at a pointer position and makes it visible. */
  const placeGhost = React.useCallback((element: HTMLDivElement, x: number, y: number) => {
    element.style.transform = `translate(${x + 14}px, ${y + 12}px)`
    element.style.visibility = "visible"
  }, [])

  // The ghost mounts one render after the drag starts. This mounting ref
  // fills it with a scaled-down snapshot of the dragged pane (a plain DOM
  // clone — nothing interactive, hidden from assistive tech) and places it
  // at the last known pointer position; without that it would stay
  // invisible until the next pointer move.
  const attachGhost = React.useCallback(
    (element: HTMLDivElement | null) => {
      ghostRef.current = element

      if (!element) return

      // Pane ids are consumer-supplied strings, so the pane is found by
      // comparing dataset values — never by interpolating the id into a
      // CSS selector, where quotes or backslashes would throw.
      const source = draggingRef.current
        ? [
            ...(workspaceRef.current?.querySelectorAll<HTMLElement>(
              '[data-slot="app-shell-pane"]',
            ) ?? []),
          ].find((pane) => pane.dataset.paneId === draggingRef.current)
        : null

      if (source) {
        const rect = source.getBoundingClientRect()
        const scale = Math.min(280 / rect.width, 220 / rect.height, 0.5)

        element.style.width = `${Math.round(rect.width * scale)}px`
        element.style.height = `${Math.round(rect.height * scale)}px`

        // The pane's content wrapper is cloned (not the pane shell), and
        // the lift-out invisibility is stripped so the ghost shows the
        // content the slot just stopped showing.
        const content =
          source.querySelector<HTMLElement>(
            '[data-slot="app-shell-pane-content"]',
          ) ?? source
        const snapshot = content.cloneNode(true) as HTMLElement
        // The clone must never look like a real pane to the drop hit test.
        snapshot.removeAttribute("data-slot")
        snapshot.removeAttribute("data-pane-id")
        snapshot.classList.remove("invisible")
        snapshot.style.width = `${rect.width}px`
        snapshot.style.height = `${rect.height}px`
        snapshot.style.transform = `scale(${scale})`
        snapshot.style.transformOrigin = "top left"
        snapshot.style.opacity = "1"
        element.replaceChildren(snapshot)
      }

      if (lastPointRef.current) {
        placeGhost(element, lastPointRef.current.x, lastPointRef.current.y)
      }
    },
    [placeGhost, workspaceRef],
  )

  // While a drop target is hovered, the pane being displaced does not
  // simply appear in the emptied slot — it travels there. One layer holds a
  // snapshot of the target's content, starts on top of the target, and
  // glides into the hole the dragged pane left, so the swap reads as two
  // things trading places rather than two things blinking.
  const attachDisplaced = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return

      const workspace = workspaceRef.current
      const sourceId = draggingRef.current
      const targetId = dropTargetRef.current?.paneId

      if (!workspace || !sourceId || !targetId) return

      // Pane ids are consumer-supplied strings, so panes are matched on
      // dataset values rather than interpolated into a CSS selector.
      const panes = [
        ...workspace.querySelectorAll<HTMLElement>(
          '[data-slot="app-shell-pane"]',
        ),
      ]
      const source = panes.find((pane) => pane.dataset.paneId === sourceId)
      const target = panes.find((pane) => pane.dataset.paneId === targetId)

      if (!source || !target) return

      const root = workspace.getBoundingClientRect()
      const from = target.getBoundingClientRect()
      const to = source.getBoundingClientRect()

      if (from.width === 0 || from.height === 0) return

      const content =
        target.querySelector<HTMLElement>(
          '[data-slot="app-shell-pane-content"]',
        ) ?? target
      const snapshot = content.cloneNode(true) as HTMLElement

      // The clone must never look like a real pane to the drop hit test.
      snapshot.removeAttribute("data-slot")
      snapshot.removeAttribute("data-pane-id")
      snapshot.classList.remove("invisible")
      // Laid out once at the size it is travelling to, so the journey is a
      // pure translation. Scaling the box to fit would stretch the content
      // by each axis independently and squash the text whenever the two
      // panes differ in shape — and the destination size is the honest
      // preview anyway, since that is what the drop actually produces.
      snapshot.style.width = "100%"
      snapshot.style.height = "100%"
      element.replaceChildren(snapshot)

      element.style.width = `${to.width}px`
      element.style.height = `${to.height}px`
      element.style.transformOrigin = "top left"

      const start = `translate(${from.left - root.left}px, ${from.top - root.top}px)`
      const end = `translate(${to.left - root.left}px, ${to.top - root.top}px)`

      element.style.transition = "none"
      element.style.transform = start
      void element.offsetWidth // settle the start without animating it

      if (
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        element.style.transform = end
        return
      }

      element.style.transition = PANE_TRAVEL_TRANSITION
      element.style.transform = end
    },
    [workspaceRef],
  )

  const startDrag = React.useCallback((paneId: LayoutNodeId) => {
    if (draggingRef.current !== null) return false

    draggingRef.current = paneId
    setDraggingPaneId(paneId)
    return true
  }, [])

  const moveDrag = React.useCallback(
    (clientX: number, clientY: number) => {
      const workspace = workspaceRef.current
      const paneId = draggingRef.current

      if (!workspace || !paneId) return

      // The ghost is positioned imperatively — a style write per pointer
      // move — so following the cursor never re-renders anything.
      lastPointRef.current = { x: clientX, y: clientY }

      if (ghostRef.current) {
        placeGhost(ghostRef.current, clientX, clientY)
      }

      const next = findDropTarget(workspace, paneId, clientX, clientY)
      const previous = dropTargetRef.current

      if (next?.paneId === previous?.paneId) {
        return
      }

      dropTargetRef.current = next
      setDropTarget(next)
    },
    [workspaceRef],
  )

  const endDrag = React.useCallback(
    (commit: boolean) => {
      const paneId = draggingRef.current
      const target = dropTargetRef.current

      draggingRef.current = null
      dropTargetRef.current = null
      lastPointRef.current = null
      setDraggingPaneId(null)
      setDropTarget(null)

      if (!commit || !paneId || !target) return

      // Both panes glide to their new spots instead of jumping; their old
      // positions must be captured before the layout changes.
      const workspace = workspaceRef.current

      if (workspace) {
        animatePaneMoves(workspace, [paneId, target.paneId])
      }

      // A drop always swaps the two panes in place — the tree's structure
      // and orientations stay exactly as they are. New sections come from
      // the explicit split actions, not from dragging.
      updateLayout(
        (current) => swapPanes(current, { paneId, withPaneId: target.paneId }),
        { operation: "swap", phase: "settled" },
      )
    },
    [updateLayout, workspaceRef],
  )

  React.useEffect(() => {
    if (draggingPaneId === null) return

    /** Cancels the drag without moving anything. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        endDrag(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [draggingPaneId, endDrag])

  const contextValue = React.useMemo<AppShellDragContextValue>(
    () => ({ draggingPaneId, dropTarget, startDrag, moveDrag, endDrag }),
    [draggingPaneId, dropTarget, startDrag, moveDrag, endDrag],
  )

  return (
    <AppShellDragContext.Provider value={contextValue}>
      {children}
      {draggingPaneId !== null && dropTarget !== null ? (
        // Keyed on the target so hovering a different pane remounts the
        // layer and replays the journey from that pane's own position.
        <div
          key={dropTarget.paneId}
          ref={attachDisplaced}
          aria-hidden
          inert
          data-slot="app-shell-displaced-pane"
          className="pointer-events-none absolute left-0 top-0 z-30 overflow-hidden rounded-lg bg-background opacity-90 shadow-lg ring-1 ring-border ring-inset"
        />
      ) : null}
      {draggingPaneId !== null ? (
        // The ghost — a faded miniature of the dragged pane — rides the
        // cursor. It mounts hidden; the mounting ref fills and places it.
        <div
          ref={attachGhost}
          aria-hidden
          inert
          data-slot="app-shell-drag-ghost"
          className="pointer-events-none invisible fixed left-0 top-0 z-50 overflow-hidden rounded-md border border-border bg-background opacity-90 shadow-lg"
        />
      ) : null}
    </AppShellDragContext.Provider>
  )
}

/** Properties accepted by the pane drag handle. */
interface AppShellPaneDragHandleProps extends React.ComponentProps<"div"> {
  /** The pane this handle moves. */
  paneId: LayoutNodeId
}

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_START_THRESHOLD = 4

/**
 * Makes part of a pane's chrome (usually its header or a grip icon)
 * draggable: press, move past a small threshold, hover another pane (its
 * whole surface highlights), and release to swap the two panes. Escape
 * cancels. Splitting into new sections stays an explicit action — dragging
 * only rearranges.
 *
 * Dragging is a pointer-only affordance; keyboard users reach the same
 * layouts through the split and close actions, so the handle stays out of
 * the tab order.
 *
 * @param props - The pane id and native container properties.
 * @returns A draggable element wired to the workspace's drag state.
 */
function AppShellPaneDragHandle({
  paneId,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  children,
  ...props
}: AppShellPaneDragHandleProps) {
  const { draggingPaneId, startDrag, moveDrag, endDrag } = useAppShellDrag()
  const pressRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    started: boolean
  } | null>(null)

  /** Ends any press or drag this handle owns. */
  const finish = (event: React.PointerEvent<HTMLElement>, commit: boolean) => {
    const press = pressRef.current

    if (!press || press.pointerId !== event.pointerId) return

    pressRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (press.started) {
      endDrag(commit)
    }
  }

  return (
    // Consumer props spread first so the attributes the handle owns win.
    <div
      {...props}
      data-slot="app-shell-pane-drag-handle"
      // Moving a pane within the workspace is this element's own pointer
      // drag, so an enclosing WindowDeck must not throw the whole window.
      data-deck-gesture="ignore"
      data-dragging={draggingPaneId === paneId || undefined}
      className={cn(
        "cursor-grab touch-none select-none data-dragging:cursor-grabbing",
        className,
      )}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || event.button !== 0 || pressRef.current)
          return

        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic pointer events (tests) have no capturable pointer id;
          // dragging still works through the element's own move events.
        }

        pressRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          started: false,
        }
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        const press = pressRef.current

        if (!press || press.pointerId !== event.pointerId) return

        if (!press.started) {
          const traveled = Math.hypot(
            event.clientX - press.startX,
            event.clientY - press.startY,
          )

          if (traveled < DRAG_START_THRESHOLD) return

          if (!startDrag(paneId)) {
            // Another pane is already being dragged; abandon this press so
            // a second pointer can never steer or commit the first drag.
            pressRef.current = null
            return
          }

          press.started = true
        }

        moveDrag(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        finish(event, true)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        finish(event, false)
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event)
        finish(event, false)
      }}
    >
      {children}
    </div>
  )
}

/** Properties accepted by the pane grabber. */
interface AppShellPaneGrabberProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The pane this grabber moves. */
  paneId: LayoutNodeId
  /**
   * Tooltip shown when the pointer rests on the grabber. Override it to
   * localize. The grabber is hidden from assistive technology, so this is
   * a pointer affordance only.
   * @defaultValue "Move"
   */
  label?: string
}

/**
 * Renders the default affordance for moving a pane: a short pill centred on
 * the pane's top edge, the way a window's title bar reads as the part you
 * pick the window up by.
 *
 * The pill appears when its pointer target is hovered. Enable it with
 * `AppShellWorkspace paneGrabber` only when the pane reserves its top centre
 * for the overlay; it occupies an 80 by 20 CSS-pixel pointer target even
 * while invisible. Hosts with their own chrome can instead place an
 * `AppShellPaneDragHandle` in that chrome.
 *
 * @param props - The pane id, an optional label, and native container
 * properties.
 * @returns The pane's grabber, positioned over its top edge.
 */
function AppShellPaneGrabber({
  paneId,
  label = "Move",
  className,
  ...props
}: AppShellPaneGrabberProps) {
  const { draggingPaneId } = useAppShellDrag()

  return (
    // The strip spans the pane so the band is centred, but only the band
    // itself takes the pointer — the rest of the top edge stays the pane's,
    // so a host's own header controls keep their clicks and never summon
    // the grabber by being hovered.
    <div
      data-slot="app-shell-pane-grabber"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
    >
      <AppShellPaneDragHandle
        {...props}
        paneId={paneId}
        // Hidden from assistive technology on purpose. Dragging is a
        // pointer-only affordance — keyboard users reach every layout the
        // grabber can produce through the split, swap, and close actions —
        // and a div announced as a control it cannot operate is worse than
        // one that is not announced at all. `title` still shows the pointer
        // tooltip.
        aria-hidden
        title={label}
        className={cn(
          // A centred band, not the whole edge: the grabber answers to the
          // middle of the header only.
          "group/app-shell-grabber pointer-events-auto",
          "flex h-5 w-20 items-center justify-center",
          "opacity-0 transition-opacity",
          "hover:opacity-100",
          draggingPaneId === paneId && "opacity-100",
          // While another pane is being dragged, this pane is a drop target
          // showing a preview of the swap. Its own grabber would sit on top
          // of that preview, so it stays down until the drag is over.
          draggingPaneId !== null &&
            draggingPaneId !== paneId &&
            "opacity-0 hover:opacity-0",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-1 w-7 rounded-full bg-muted-foreground/40 transition-colors",
            "group-hover/app-shell-grabber:bg-muted-foreground/60",
          )}
        />
      </AppShellPaneDragHandle>
    </div>
  )
}

export {
  AppShellDragProvider,
  AppShellPaneDragHandle,
  AppShellPaneGrabber,
  useAppShellDrag,
  type AppShellDragContextValue,
  type AppShellPaneDragHandleProps,
  type AppShellPaneGrabberProps,
  type PaneDropTarget,
}
