"use client"

/** @responsibility Renders one window of a WindowDeck: its chrome, its host-supplied content, its behaviour as an overview tile, and the throw that dismisses it. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  composeRefs,
  useWindowDeck,
  type WindowDeckDismissDirection,
  type WindowDeckDismissal,
} from "./window-deck-context"
import { longestTransitionMs } from "./window-deck-motion"

/** How far a pane must travel before releasing it dismisses it, in pixels. */
const DISMISS_DISTANCE = 72

/** Speed that dismisses a pane regardless of distance, in pixels per ms. */
const DISMISS_VELOCITY = 0.5

/** How much of a drag against the allowed directions is shown, as a ratio. */
const RUBBER_BAND = 0.18

/** How far a gesture must travel before it stops being a tap. */
const ENGAGE_DISTANCE = 8

/** The default throw: up and out, as a window is dismissed from an overview. */
const DEFAULT_DIRECTIONS: readonly WindowDeckDismissDirection[] = ["up"]

/** Properties accepted by one WindowDeck pane. */
interface WindowDeckPaneProps
  extends Omit<React.ComponentProps<"div">, "id" | "title" | "onDismiss"> {
  /**
   * Unique id of the pane within its deck. Keys selection and is rendered as
   * the element id.
   */
  id: string
  /**
   * The pane's accessible name. It names the pane's group in the carousel
   * and its tile in the overview, so give it the name of the window rather
   * than a description of its content.
   */
  label: string
  /** Chrome across the top of the window, above its content. */
  header?: React.ReactNode
  /** Chrome across the bottom of the window, below its content. */
  footer?: React.ReactNode
  /**
   * Whether the pane's content scrolls on its own. Turn it off when the
   * content fills the pane or manages its own scrolling, as a photograph, a
   * message list, or a canvas does.
   * @defaultValue true
   */
  scrollable?: boolean
  /**
   * Whether the pane draws a window surface — border, background, and
   * shadow. Turn it off for content that should reach the pane's edges, such
   * as a photograph.
   * @defaultValue true
   */
  chrome?: boolean
  /** Classes for the header slot, for chrome the window frame should not dictate. */
  headerClassName?: string
  /** Classes for the content slot. */
  contentClassName?: string
  /** Classes for the footer slot. */
  footerClassName?: string
  /**
   * Whether the user may throw this pane away. Defaults to true once
   * `onDismiss` is supplied, so a pinned pane in a dismissible deck sets it
   * to false explicitly.
   * @defaultValue true when onDismiss is given
   */
  dismissible?: boolean
  /**
   * The edges this pane may be thrown towards. A drag in any other direction
   * rubber-bands and springs back, and the deck's dismiss shortcut reports
   * the first direction listed.
   * @defaultValue ["up"]
   */
  dismissDirections?: readonly WindowDeckDismissDirection[]
  /**
   * Called once the pane has finished leaving, with the direction it went,
   * whether it was thrown or dismissed from the keyboard, and how far and
   * fast it travelled. The host removes the pane from its own data; the deck
   * re-tiles the rest around the gap. A host that declines to remove it gets
   * the pane back where it was.
   */
  onDismiss?: (dismissal: WindowDeckDismissal) => void
  /**
   * Cheap stand-in shown when the pane's full content is not mounted — in
   * the overview strip, and nowhere else. The live window keeps rendering
   * `children`; a host that needs every tree alive passes
   * `contentMount="always"` on the deck instead.
   */
  preview?: React.ReactNode
}

/** A dismissal gesture in progress. */
interface DragState {
  /** The pointer driving it. */
  pointerId: number
  /** Where it started, in client coordinates. */
  originX: number
  originY: number
  /** When it started, for the fling velocity. */
  startedAt: number
  /** The offset last seen, in pixels. */
  offsetX: number
  offsetY: number
  /** Its speed at the last sample, in pixels per millisecond. */
  velocity: number
  /** Whether the gesture has committed to being a drag rather than a tap. */
  engaged: boolean
}

/** How far, and which way, a released gesture travelled. */
interface Throw {
  direction: WindowDeckDismissDirection
  distance: number
  velocity: number
}

/**
 * Reads a released gesture as a throw towards one of the allowed edges.
 *
 * @param drag - The gesture at the moment of release.
 * @param directions - The edges this pane may be thrown towards.
 * @returns The throw, or undefined when the gesture was not one.
 */
function readThrow(
  drag: DragState,
  directions: readonly WindowDeckDismissDirection[],
): Throw | undefined {
  const candidates: { direction: WindowDeckDismissDirection; distance: number }[] =
    [
      { direction: "up", distance: -drag.offsetY },
      { direction: "down", distance: drag.offsetY },
      { direction: "left", distance: -drag.offsetX },
      { direction: "right", distance: drag.offsetX },
    ]
  const best = candidates
    .filter((candidate) => directions.includes(candidate.direction))
    .reduce<{ direction: WindowDeckDismissDirection; distance: number } | undefined>(
      (winner, candidate) =>
        winner === undefined || candidate.distance > winner.distance
          ? candidate
          : winner,
      undefined,
    )

  if (best === undefined || best.distance <= 0) return undefined

  // A short flick counts as much as a long drag: the gesture is a throw, and
  // requiring the full distance would make a fast one feel ignored.
  const flung =
    best.distance > DISMISS_DISTANCE * 0.4 && drag.velocity >= DISMISS_VELOCITY

  if (best.distance < DISMISS_DISTANCE && !flung) return undefined

  return { ...best, velocity: drag.velocity }
}

/**
 * Renders one window in a WindowDeck. The pane holds no layout state of its
 * own: the deck decides where it sits, how it is scaled, and whether it is
 * currently a tile or the focused window.
 *
 * Its content is whatever the host composes into it — a conversation, a
 * calendar, a board, a photograph, an offer card — and the pane supplies the
 * frame, the optional header and footer chrome, the tile behaviour, and the
 * throw that dismisses it. Full `children` mount only while this pane is
 * the live window; pass `preview` for the cheap stand-in the overview
 * strip shows for everyone else.
 *
 * @param props - The pane id and accessible name, its chrome, its dismissal
 * contract, and native container properties.
 * @returns One window of the deck.
 */
function WindowDeckPane({
  id,
  label,
  header,
  footer,
  scrollable = true,
  chrome = true,
  headerClassName,
  contentClassName,
  footerClassName,
  dismissible = true,
  dismissDirections = DEFAULT_DIRECTIONS,
  onDismiss,
  preview,
  className,
  style,
  children,
  ref,
  ...props
}: WindowDeckPaneProps) {
  const {
    activePaneId,
    dismissRequest,
    mode,
    overviewPanning,
    panOverview,
    registerPane,
    reportDismissal,
    restorePaneId,
    selectPane,
    settling,
    shouldMountContent,
    shouldMountPreview,
    tileFor,
  } = useWindowDeck()
  const elementRef = React.useRef<HTMLDivElement>(null)
  // Memoized so React does not detach and re-attach refs on every render.
  const composedRef = React.useMemo(() => composeRefs(elementRef, ref), [ref])
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [dragging, setDragging] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [retained, setRetained] = React.useState(0)

  const overview = mode === "overview"
  const active = activePaneId === id
  const tile = overview ? tileFor(id) : undefined
  const throwable = dismissible && onDismiss !== undefined && overview
  const contentMounted = shouldMountContent(id)
  const previewMounted = !contentMounted && shouldMountPreview(id)
  const body = contentMounted ? children : previewMounted ? preview : null

  React.useLayoutEffect(() => {
    const element = elementRef.current

    if (!element) return

    return registerPane({ id, element })
  }, [id, registerPane])

  // Everything the exit needs is read through refs: the listeners are
  // attached once per gesture and must not be rebuilt when the host
  // re-renders, and the exit outlives the commit that started it.
  // A throw ends in a click on the tile it started on. That click must not
  // also open the pane the user just threw away.
  const suppressClickRef = React.useRef(false)
  const dismissalRef = React.useRef<WindowDeckDismissal | null>(null)
  const latchedRef = React.useRef(false)
  const onDismissRef = React.useRef(onDismiss)
  const reportRef = React.useRef(reportDismissal)
  const directionsRef = React.useRef(dismissDirections)

  React.useEffect(() => {
    onDismissRef.current = onDismiss
    reportRef.current = reportDismissal
    directionsRef.current = dismissDirections
  })

  /**
   * Hands the host the dismissal exactly once, then restores the pane.
   *
   * The restore matters for a host that declines the removal — an undo, a
   * confirmation, a failed request: the pane must come back where it was
   * rather than sit invisible in the grid forever.
   */
  const completeDismissal = React.useCallback(() => {
    const dismissal = dismissalRef.current

    if (!dismissal || latchedRef.current) return
    latchedRef.current = true
    dismissalRef.current = null

    onDismissRef.current?.(dismissal)
    reportRef.current(dismissal.paneId, "left")
    // Leave suppressClickRef set. Under reduced motion the exit is
    // synchronous and the click that ends a throw is still in the queue;
    // clearing the guard here would open the pane the user just threw.
    setLeaving(false)
    setOffset({ x: 0, y: 0 })
    setRetained((current) => current + 1)
    latchedRef.current = false
  }, [])

  // Reached only if the pane is still mounted after the host was handed the
  // dismissal, which is exactly the case where the host declined it. A host
  // that removed the pane never runs this.
  React.useEffect(() => {
    if (retained === 0) return
    reportRef.current(id, "retained")
  }, [id, retained])

  /**
   * Plays the pane off the deck and hands the host the dismissal when it
   * lands.
   *
   * The landing is timed from the transition the element actually runs, so a
   * theme or a host that turns motion off completes the dismissal at once
   * instead of waiting for a `transitionend` that never fires.
   */
  const dismiss = React.useCallback(
    (dismissal: WindowDeckDismissal) => {
      const element = elementRef.current

      if (!element || dismissalRef.current) return
      dismissalRef.current = dismissal

      const box = element.getBoundingClientRect()
      const away = {
        up: { x: 0, y: -(box.bottom + box.height) },
        down: { x: 0, y: window.innerHeight - box.top + box.height },
        left: { x: -(box.right + box.width), y: 0 },
        right: { x: window.innerWidth - box.left + box.width, y: 0 },
      }[dismissal.direction]

      setDragging(false)
      setLeaving(true)
      setOffset(away)
    },
    [],
  )

  // Timed from the leaving class after it has committed, so the duration is
  // the throw's own curve — not the coast the pane was on when dismiss()
  // ran — and a theme that zeroes motion completes at once.
  React.useLayoutEffect(() => {
    if (!leaving) return

    const element = elementRef.current

    if (!element) return

    const duration = longestTransitionMs(element)

    if (duration === 0) {
      completeDismissal()
      return
    }

    const timer = window.setTimeout(completeDismissal, duration + 50)

    return () => window.clearTimeout(timer)
  }, [completeDismissal, leaving])

  // The deck asks for a dismissal when the keyboard is used, so a thrown
  // pane and a dismissed one leave along the same path.
  const handledRequestRef = React.useRef(0)

  React.useEffect(() => {
    if (dismissRequest?.paneId !== id) return
    // Each request is answered once. A pane remounting under an id whose
    // request was never completed must not dismiss itself on sight.
    if (handledRequestRef.current >= dismissRequest.nonce) return
    handledRequestRef.current = dismissRequest.nonce
    if (!dismissible || !onDismissRef.current) return

    dismiss({
      paneId: id,
      direction: directionsRef.current[0] ?? "up",
      reason: "shortcut",
      distance: 0,
      velocity: 0,
    })
  }, [dismiss, dismissRequest, dismissible, id])

  /**
   * Opens this pane. In the overview that returns the deck to the carousel
   * on this window; in the carousel it centres this window.
   */
  const open = () => selectPane(id)

  // The gesture is tracked on the window rather than on the pane: a throw
  // routinely leaves the tile it started on, and a pointer released outside
  // it must still end the drag rather than strand the pane in mid-air.
  const endDragRef = React.useRef<(() => void) | null>(null)

  React.useEffect(() => () => endDragRef.current?.(), [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    props.onPointerDown?.(event)
    if (leaving || event.defaultPrevented) return
    // Overview tiles always listen: sideways travel pans the strip even on
    // a pane that cannot be thrown. Carousel panes only listen to dismiss.
    if (!throwable && !overview) return
    // A second finger must not restart the drag the first one is running,
    // which would snap the pane back under the user's hand.
    if (endDragRef.current) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    suppressClickRef.current = false
    let panning = false

    const drag: DragState = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startedAt: event.timeStamp,
      offsetX: 0,
      offsetY: 0,
      velocity: 0,
      engaged: false,
    }

    /** Detaches the gesture's listeners and forgets it. */
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", cancel)
      endDragRef.current = null
    }

    /** Springs the pane back to where the deck put it. */
    const release = () => {
      stop()
      setDragging(false)
      setOffset({ x: 0, y: 0 })
    }

    /** Tracks the pointer once the gesture has committed to being a drag. */
    const move = (native: PointerEvent) => {
      if (native.pointerId !== drag.pointerId) return

      const deltaX = native.clientX - drag.originX
      const deltaY = native.clientY - drag.originY

      if (!drag.engaged) {
        if (Math.hypot(deltaX, deltaY) < ENGAGE_DISTANCE) return
        // Sideways travel in the overview is a scroll of the strip, not a
        // throw. A pane that cannot be dismissed still pans this way.
        if (overview && Math.abs(deltaX) > Math.abs(deltaY)) {
          drag.engaged = true
          panning = true
          drag.offsetX = deltaX
          suppressClickRef.current = true
          panOverview(-deltaX)
          return
        }
        if (!throwable) return
        drag.engaged = true
        suppressClickRef.current = true
        setDragging(true)
      } else if (panning) {
        const travelled = deltaX - drag.offsetX
        drag.offsetX = deltaX
        drag.offsetY = deltaY
        panOverview(-travelled)
        return
      }

      const directions = directionsRef.current
      const elapsed = Math.max(1, native.timeStamp - drag.startedAt)

      drag.offsetX = deltaX
      drag.offsetY = deltaY
      drag.velocity = Math.hypot(deltaX, deltaY) / elapsed

      // Travel towards an edge the pane can leave by is followed exactly;
      // travel any other way is rubber-banded, so the pane still answers the
      // hand without promising a dismissal it will not perform.
      const follow = (
        distance: number,
        towards: WindowDeckDismissDirection,
        away: WindowDeckDismissDirection,
      ) => {
        const allowed = distance < 0 ? towards : away

        return directions.includes(allowed) ? distance : distance * RUBBER_BAND
      }

      setOffset({
        x: follow(deltaX, "left", "right"),
        y: follow(deltaY, "up", "down"),
      })
    }

    /** Settles the gesture: a throw dismisses, anything else springs back. */
    const finish = (native: PointerEvent) => {
      if (native.pointerId !== drag.pointerId) return
      stop()
      if (!drag.engaged || panning) {
        if (!drag.engaged) suppressClickRef.current = false
        return
      }

      const thrown = readThrow(drag, directionsRef.current)

      if (!thrown) {
        setDragging(false)
        setOffset({ x: 0, y: 0 })
        return
      }
      dismiss({ paneId: id, reason: "gesture", ...thrown })
    }

    /** Abandons the gesture when the platform takes the pointer away. */
    const cancel = (native: PointerEvent) => {
      if (native.pointerId !== drag.pointerId) return
      release()
    }

    endDragRef.current = release
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", cancel)
  }

  // The pane's content is never in the tab order unless the user is looking
  // at it: in the overview every window is a tile, and in the carousel the
  // windows either side are scenery.
  const contentInert = overview || !active
  // A pane the user can open is a control in its own right, and must be
  // reachable and operable from the keyboard rather than by pointer alone.
  const openable = overview || !active

  const moved = offset.x !== 0 || offset.y !== 0
  const transform =
    tile || moved
      ? {
          translate: `${(tile?.x ?? 0) + offset.x}px ${(tile?.y ?? 0) + offset.y}px`,
          ...(tile ? { scale: `${tile.scale}` } : {}),
        }
      : undefined

  return (
    // Consumer props spread first so the attributes the pane owns (id, slot,
    // transform, ref, and its gesture and tile behaviour) always win.
    <div
      {...props}
      ref={composedRef}
      id={id}
      data-slot="window-deck-pane"
      data-active={active ? "" : undefined}
      data-mode={mode}
      data-dragging={dragging ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      data-dismissible={
        dismissible && onDismiss !== undefined ? "" : undefined
      }
      data-content={
        contentMounted ? "live" : previewMounted ? "preview" : "empty"
      }
      role={openable ? "button" : "group"}
      tabIndex={openable ? 0 : -1}
      aria-label={label}
      // In the overview the deck marks the window Escape returns to; in the
      // carousel it marks the window the deck is centred on. Either way the
      // state is carried semantically, not by opacity alone.
      aria-current={
        overview
          ? restorePaneId === id
            ? "true"
            : undefined
          : active
            ? "true"
            : undefined
      }
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) return
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        if (openable) open()
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (openable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          open()
          return
        }
        // Delete on a focused tile removes it, so the dismissal is on the
        // pane the user is actually on rather than on whichever one the deck
        // happens to have focused.
        if (!overview || !throwable) return
        if (event.key !== "Backspace" && event.key !== "Delete") return
        // Unmodified only. A chord such as Mod+Backspace is the deck's to
        // interpret, and swallowing it here would leave two bindings for one
        // action that disagree about which pane they act on.
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return
        }
        event.preventDefault()
        dismiss({
          paneId: id,
          direction: dismissDirections[0] ?? "up",
          reason: "shortcut",
          distance: 0,
          velocity: 0,
        })
      }}
      onPointerDown={handlePointerDown}
      style={transform ? { ...style, ...transform } : style}
      className={cn(
        "relative flex w-(--nessa-window-deck-pane-width) flex-none snap-center flex-col overflow-hidden outline-none",
        "h-(--nessa-window-deck-pane-height)",
        chrome &&
          "rounded-xl border border-border bg-card text-card-foreground shadow-lg",
        // Everything the deck moves is a transform, so a pane never reflows
        // its content while it travels between carousel, tile, and off-deck.
        //
        // The curve is the standard one rather than the emphasized one, and
        // the duration is half again the slow token: a window leaves at once
        // and coasts into place, which is how a spring of the weight this
        // movement wants behaves. Easing in at the start — which is what the
        // emphasized curve does — reads as the deck hesitating. Both stay
        // derived from the motion tokens, so reduced motion still zeroes them.
        "origin-center transition-[translate,scale,opacity] [transition-duration:calc(var(--nessa-motion-duration-slow)*1.5)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
        // Promoted for the movement, not for the pane's whole life. Twenty
        // windows of chat would otherwise stay as twenty compositor layers.
        // Overview, settle, drag, and leave are the commits that need it.
        (overview || settling || dragging || leaving) &&
          "[will-change:transform,opacity] motion-reduce:[will-change:auto]",
        // Panning the strip updates every tile's translate each tick; easing
        // those writes would make the page lag the hand.
        overview && overviewPanning && "transition-none",
        // A discarded window is the exception: it accelerates away instead of
        // coasting, so it reads as thrown rather than as placed.
        leaving &&
          "[transition-duration:calc(var(--nessa-motion-duration-slow)*0.95)] [transition-timing-function:cubic-bezier(0.4,0,0.7,0.2)]",
        // A drag tracks the pointer exactly; only its release is animated.
        dragging && "transition-none",
        // The deck clips its scroller, so the outline draws inset: an outset
        // ring on the edge pane would be cut off.
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        // Carousel: the focused window is at rest and its neighbours recede.
        mode === "carousel" &&
          (active
            ? "opacity-100"
            : "cursor-pointer translate-y-2 scale-90 opacity-40"),
        // Overview: every window is an equal, pointer-addressable tile.
        overview && (chrome ? "cursor-pointer shadow-xl" : "cursor-pointer"),
        // A pane that can be thrown owns the gesture outright: leaving the
        // browser its own panning would cancel the throw halfway.
        throwable && "touch-none",
        leaving && "pointer-events-none opacity-0",
        // The settle back to the carousel keeps the panes inert until it
        // lands, so a stray click cannot hit a surface that is still moving.
        settling && "pointer-events-none",
        className,
      )}
    >
      {header ? (
        <div
          data-slot="window-deck-pane-header"
          inert={contentInert}
          className={cn(
            "flex shrink-0 items-center gap-2 px-3 py-2",
            chrome && "border-b border-border",
            headerClassName,
          )}
        >
          {header}
        </div>
      ) : null}
      <div
        data-slot="window-deck-pane-content"
        inert={contentInert}
        className={cn(
          "min-h-0 flex-1",
          scrollable && "overflow-y-auto overscroll-contain",
          contentClassName,
        )}
      >
        {body}
      </div>
      {footer ? (
        <div
          data-slot="window-deck-pane-footer"
          inert={contentInert}
          className={cn(
            "flex shrink-0 items-center gap-2 px-3 py-2",
            chrome && "border-t border-border",
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export { WindowDeckPane, type WindowDeckPaneProps }
