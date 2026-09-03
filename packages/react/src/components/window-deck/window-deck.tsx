"use client"

/** @responsibility Owns a deck of windows: which one is focused, whether the deck is a carousel or an overview, the transition between the two, the removal of a dismissed pane, and the keyboard contract that drives it all. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  WindowDeckContext,
  composeRefs,
  sortByDocumentPosition,
  type RegisteredWindowDeckPane,
  type WindowDeckContentMount,
  type WindowDeckMode,
} from "./window-deck-context"
import {
  clampOverviewScroll,
  computeOverviewLayout,
  overviewPreviewInView,
  overviewScrollToCentre,
  overviewScrollToReveal,
  type WindowDeckOverviewLayout,
  type WindowDeckOverviewOptions,
  type WindowDeckRect,
  type WindowDeckTile,
} from "./window-deck-layout"
import { longestTransitionMs } from "./window-deck-motion"
import {
  isEditableShortcutTarget,
  matchesWindowDeckShortcut,
  resolveWindowDeckShortcuts,
  type WindowDeckShortcuts,
} from "./window-deck-shortcuts"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

/**
 * How long a pane that came back after its dismissal is still treated as one
 * the host might yet remove, in milliseconds.
 */
const RETAINED_GRACE_MS = 1000

/** Keyboard events already claimed by one deck's shortcut handler. */
const handledShortcutEvents = new WeakSet<KeyboardEvent>()

/** The announcements the deck makes to assistive technology. */
interface WindowDeckLabels {
  /** Announced when the overview opens. */
  overviewOpened: (paneCount: number) => string
  /** Announced when the deck returns to one window. */
  overviewClosed: (paneName: string) => string
  /** Announced when a pane is thrown away or dismissed. */
  paneDismissed: (paneName: string) => string
}

/** The announcements a host may replace, and the strings they default to. */
const windowDeckDefaultLabels: WindowDeckLabels = {
  overviewOpened: (paneCount) =>
    paneCount === 1 ? "Overview, 1 window" : `Overview, ${paneCount} windows`,
  overviewClosed: (paneName) => `${paneName}, full view`,
  paneDismissed: (paneName) => `${paneName} dismissed`,
}

/** Properties accepted by a WindowDeck. */
interface WindowDeckProps extends React.ComponentProps<"div"> {
  /** The focused pane's id, for a controlled deck. */
  activePane?: string
  /** The pane focused initially, for an uncontrolled deck. */
  defaultActivePane?: string
  /** Called whenever the focused pane changes, by any route. */
  onActivePaneChange?: (paneId: string) => void
  /** The presentation mode, for a controlled deck. */
  mode?: WindowDeckMode
  /**
   * The mode the deck opens in, for an uncontrolled deck.
   * @defaultValue "carousel"
   */
  defaultMode?: WindowDeckMode
  /** Called whenever the presentation mode changes, by any route. */
  onModeChange?: (mode: WindowDeckMode) => void
  /**
   * The deck's keymap. Pass a partial map to rebind an action, `false` on an
   * action to drop it, or `false` here to turn off keyboard control
   * entirely. Escape always leaves the overview, as it does in a dialog, and
   * Delete always dismisses the tile the user is focused on.
   * @defaultValue Mod+G toggles the overview; Mod+Arrow moves between panes
   */
  shortcuts?: WindowDeckShortcuts | false
  /**
   * Width of one window, as a CSS length. The deck's scroller is a query
   * container, so size a pane against the deck with `cqw` rather than `%`: a
   * percentage resolves against the rail, whose width is the sum of the
   * panes standing on it.
   * @defaultValue "min(880px, 82cqw)"
   */
  paneWidth?: string
  /**
   * Height of one window, as a CSS length. Panes are the same size by
   * default, which is what keeps the overview a strip of equals; pass "auto"
   * to let each pane take its content's height instead. With the default
   * `contentMount`, unmounted frames reuse the live window's measured height
   * so the rail does not collapse around empty neighbours.
   * @defaultValue "100%"
   */
  paneHeight?: string
  /**
   * Which pane trees stay mounted. `active` keeps only the live window's
   * content alive — overview tiles show `preview` (or empty chrome) and far
   * panes stay frames. `always` mounts every tree, for hosts whose hidden
   * windows must keep running work.
   * @defaultValue "active"
   */
  contentMount?: WindowDeckContentMount
  /**
   * How many overview tiles the viewport shows at once. Extra windows
   * extend the strip to the side; scroll or arrow to reach them. Clamped
   * further if the viewport cannot hold that many readable tiles.
   * @defaultValue 8
   */
  overviewVisibleCount?: number
  /**
   * Gap, inset, and visible-count overrides for the overview strip. The
   * deck reads this by value, so an object written inline is safe.
   */
  overviewLayout?: WindowDeckOverviewOptions
  /**
   * Whether a vertical wheel gesture over the deck moves the carousel
   * sideways. Content that scrolls on its own keeps its own gesture.
   * @defaultValue true
   */
  wheelNavigation?: boolean
  /** Overrides for the announcements the deck makes, for localization. */
  labels?: Partial<WindowDeckLabels>
}

/**
 * Whether two tile layouts place every pane identically.
 *
 * @param current - The layout already rendered.
 * @param next - The freshly measured layout.
 * @returns Whether re-rendering would change nothing.
 */
function sameTiles(
  current: Record<string, WindowDeckTile>,
  next: Record<string, WindowDeckTile>,
): boolean {
  const ids = Object.keys(next)

  if (ids.length !== Object.keys(current).length) return false

  return ids.every((id) => {
    const before = current[id]
    const after = next[id]

    return (
      before !== undefined &&
      before.x === after.x &&
      before.y === after.y &&
      before.scale === after.scale
    )
  })
}

/**
 * The scroll offset that centres one pane in the scroller.
 *
 * Both elements are measured in layout coordinates rather than from painted
 * rectangles, so a pane that is currently scaled down — every pane but the
 * focused one — still reports the box the carousel actually reserves for it.
 *
 * @param viewport - The deck's scroller.
 * @param pane - The pane to centre.
 * @returns The scrollLeft that puts the pane in the middle.
 */
function centeredScrollLeft(viewport: HTMLElement, pane: HTMLElement): number {
  return (
    pane.offsetLeft -
    viewport.offsetLeft -
    (viewport.clientWidth - pane.offsetWidth) / 2
  )
}

/**
 * Whether a wheel gesture started somewhere that scrolls vertically on its
 * own, in which case the deck must not take it.
 *
 * @param target - The element the gesture landed on.
 * @param boundary - The deck's scroller, where the search stops.
 * @returns Whether an ancestor consumes the vertical gesture.
 */
function hasScrollableAncestor(
  target: EventTarget | null,
  boundary: HTMLElement,
): boolean {
  // Element, not HTMLElement: an SVG icon inside a scrolling list is still
  // a descendant of that list, and walking from null would steal its wheel.
  let node = target instanceof Element ? target : null

  while (node && node !== boundary) {
    if (node instanceof HTMLElement) {
      const overflowY = window.getComputedStyle(node).overflowY

      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return true
      }
    }
    node = node.parentElement
  }

  return false
}

/**
 * Whether focus is sitting on the document itself rather than on a control.
 * That is the case a dismissal left behind; a host that moved focus to a
 * toast or a dialog has an element of its own and must keep it.
 */
function isDocumentFocus(owner: Document, active: Element | null): boolean {
  return (
    active === null ||
    active === owner.body ||
    active === owner.documentElement
  )
}

/**
 * A deck of windows the user moves between: a horizontal carousel that
 * centres one window at a time, and an overview that shrinks the live
 * window into a strip of preview tiles. The viewport shows a capped page
 * of those tiles; the rest of the strip scrolls sideways. Mod+G switches
 * between the two; clicking or pressing Enter on a tile returns to the
 * carousel on that window, and a tile whose host made it dismissible can be
 * thrown off the deck.
 *
 * Only the live window mounts its full content tree. Overview tiles and
 * carousel neighbours are frames — host-supplied `preview` nodes, or empty
 * chrome — so opening the overview does not mount every pane. Pass
 * `contentMount="always"` when hidden windows must keep running work.
 *
 * The deck is content-agnostic. Each `WindowDeckPane` is a frame the host
 * composes any Nessa components into — a conversation, a calendar, a board, a
 * photograph, an offer card — and the deck only owns where those frames sit
 * and how they move.
 *
 * Both the focused pane and the mode may be controlled or left to the deck.
 *
 * The deck's scroller is a size query container, which makes it the
 * containing block for `position: fixed` content inside a pane. Content that
 * must escape the deck — a dialog, a menu that outgrows the window — should
 * be rendered into a portal, as the Nessa overlay components already are.
 *
 * @param props - Selection, mode, keymap, sizing, and native container
 * properties.
 * @returns The deck, its scroller, and the panes composed into it.
 */
function WindowDeck({
  activePane,
  defaultActivePane,
  onActivePaneChange,
  mode,
  defaultMode = "carousel",
  onModeChange,
  shortcuts,
  paneWidth = "min(880px, 82cqw)",
  paneHeight = "100%",
  contentMount = "active",
  overviewVisibleCount,
  overviewLayout,
  wheelNavigation = true,
  labels: labelsProp,
  className,
  style,
  children,
  ref,
  ...props
}: WindowDeckProps) {
  const [panes, setPanes] = React.useState<RegisteredWindowDeckPane[]>([])
  const [uncontrolledActive, setUncontrolledActive] = React.useState<
    string | undefined
  >(defaultActivePane)
  const [uncontrolledMode, setUncontrolledMode] =
    React.useState<WindowDeckMode>(defaultMode)
  const [tiles, setTiles] = React.useState<Record<string, WindowDeckTile>>({})
  const [overviewStrip, setOverviewStrip] = React.useState<WindowDeckOverviewLayout | null>(
    null,
  )
  const [overviewScroll, setOverviewScroll] = React.useState(0)
  const [overviewPanning, setOverviewPanning] = React.useState(false)
  const [measuredPaneHeight, setMeasuredPaneHeight] = React.useState<number | undefined>(
    undefined,
  )
  const [settling, setSettling] = React.useState(false)
  // Nonced, so a request that never completed cannot dismiss a later pane
  // that happens to mount under the same id.
  const [dismissRequest, setDismissRequest] = React.useState<
    { paneId: string; nonce: number } | undefined
  >(undefined)
  const dismissNonceRef = React.useRef(0)
  const [announcement, setAnnouncement] = React.useState("")

  const rootRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const railRef = React.useRef<HTMLDivElement>(null)
  const composedRef = React.useMemo(() => composeRefs(rootRef, ref), [ref])
  // The pane the overview should return to when it is dismissed rather than
  // opened onto a specific window. Held as state as well as a ref: the tiles
  // mark it with aria-current, so a render must see the current value, while
  // the handlers need to read and write it synchronously.
  const [restorePaneId, setRestorePaneId] = React.useState<string | undefined>(
    undefined,
  )
  const restoreRef = React.useRef<string | undefined>(undefined)

  /**
   * Records the window the overview returns to.
   *
   * @param paneId - The window to return to, or undefined for none.
   */
  const setRestore = React.useCallback((paneId: string | undefined) => {
    restoreRef.current = paneId
    setRestorePaneId(paneId)
  }, [])
  // The pane a pending settle is landing on, read by the layout effect that
  // performs the scroll jump in the same commit as the carousel styles.
  const pendingSettleRef = React.useRef<string | undefined>(undefined)
  // Finishes a settle that is still running, so a second visit to the
  // overview never measures a rail that is mid-slide.
  const finishSettleRef = React.useRef<(() => void) | null>(null)
  // The mode the last commit rendered, so the settle runs on the transition
  // out of the overview however the host got there.
  // Always starts at the carousel, so a deck that opens in the overview
  // still runs the entry branch below and seeds the window it returns to.
  const previousModeRef = React.useRef<WindowDeckMode>("carousel")
  const scrollFrameRef = React.useRef<number | null>(null)
  // A selection that came from the user's own scrolling must not be answered
  // with a scroll of our own, or the carousel fights the gesture. A scroll
  // the deck itself started must not be read back as a selection at all, or
  // one keypress reports every window it travels past.
  const fromScrollRef = React.useRef(false)
  const programmaticScrollRef = React.useRef(false)
  const scrollTokenRef = React.useRef(0)
  // Whether the deck has already told its host that it has no room for a grid.
  const forcedCarouselRef = React.useRef(false)
  const centeredRef = React.useRef(false)
  // A dismissal a pane has finished playing, waiting to see whether the host
  // actually removes it.
  const pendingRemovalsRef = React.useRef(
    new Map<
      string,
      { wasActive: boolean; neighbour: string | undefined; name: string }
    >(),
  )
  // Retained panes waiting out their grace period, so the timers can be
  // cleared if the deck goes away first.
  const retainedTimersRef = React.useRef(new Map<string, number>())
  const panesRef = React.useRef(panes)
  const activePaneIdRef = React.useRef<string | undefined>(undefined)
  const mountedRef = React.useRef(true)
  // Written synchronously in the settle layout effect so the same commit's
  // passive effects — and the keymap — can see that a return is in flight
  // before `settling` has rendered.
  const settlingRef = React.useRef(false)
  const scrollReleaseTimerRef = React.useRef<number | undefined>(undefined)
  const overviewPanTimerRef = React.useRef<number | undefined>(undefined)
  const overviewScrollRef = React.useRef(0)
  const overviewStripRef = React.useRef<WindowDeckOverviewLayout | null>(null)
  // Ids that have actually registered. An unresolved defaultActivePane is
  // "not yet mounted", not "gone", and must not be rewritten to paneIds[0].
  const seenPaneIdsRef = React.useRef(new Set<string>())
  // The removal effect already told the host the neighbour. The dead-id
  // correction must not follow it with paneIds[0] in the same flush.
  const correctedFromRemovalRef = React.useRef(false)

  panesRef.current = panes

  const labels = React.useMemo<WindowDeckLabels>(
    () => ({ ...windowDeckDefaultLabels, ...labelsProp }),
    [labelsProp],
  )
  const paneIds = React.useMemo(() => panes.map((pane) => pane.id), [panes])
  const resolvedMode = mode ?? uncontrolledMode
  const requestedActive = activePane ?? uncontrolledActive
  const activePaneId =
    requestedActive !== undefined && paneIds.includes(requestedActive)
      ? requestedActive
      : paneIds[0]

  activePaneIdRef.current = activePaneId

  for (const id of paneIds) seenPaneIdsRef.current.add(id)

  // Read by value, so a host writing `overviewLayout={{ maxVisible: 4 }}`
  // inline does not hand the measurement a new identity on every render.
  const { columns, maxVisible, gap, insets, minScale, minTileWidth } =
    overviewLayout ?? {}
  const insetTop = insets?.top
  const insetBottom = insets?.bottom
  const insetHorizontal = insets?.horizontal
  const overviewOptions = React.useMemo<WindowDeckOverviewOptions>(
    () => ({
      columns,
      maxVisible: overviewVisibleCount ?? maxVisible,
      gap,
      minScale,
      minTileWidth,
      insets: { top: insetTop, bottom: insetBottom, horizontal: insetHorizontal },
    }),
    [
      columns,
      gap,
      insetBottom,
      insetHorizontal,
      insetTop,
      maxVisible,
      minScale,
      minTileWidth,
      overviewVisibleCount,
    ],
  )

  React.useEffect(() => {
    // StrictMode remounts run cleanup then setup again — re-arm so a settle
    // that finishes after the simulated unmount can still clear `settling`.
    mountedRef.current = true
    const timers = retainedTimersRef.current

    return () => {
      mountedRef.current = false
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
      if (scrollReleaseTimerRef.current !== undefined) {
        window.clearTimeout(scrollReleaseTimerRef.current)
        scrollReleaseTimerRef.current = undefined
      }
      if (overviewPanTimerRef.current !== undefined) {
        window.clearTimeout(overviewPanTimerRef.current)
        overviewPanTimerRef.current = undefined
      }
      // StrictMode's effect remount clears the 0ms release timer; without
      // this the lock stays set and scroll-driven selection never resumes.
      programmaticScrollRef.current = false
    }
  }, [])

  const paneElement = React.useCallback(
    (paneId: string | undefined) =>
      panesRef.current.find((pane) => pane.id === paneId)?.element,
    [],
  )

  const registerPane = React.useCallback((pane: RegisteredWindowDeckPane) => {
    setPanes((current) =>
      sortByDocumentPosition([
        ...current.filter((entry) => entry.id !== pane.id),
        pane,
      ]),
    )

    return () => {
      setPanes((current) => current.filter((entry) => entry.id !== pane.id))
      // A request that named this instance must not survive to dismiss a
      // pane remounted under the same id.
      setDismissRequest((current) =>
        current?.paneId === pane.id ? undefined : current,
      )
    }
  }, [])

  const setActive = React.useCallback(
    (paneId: string) => {
      if (activePane === undefined) setUncontrolledActive(paneId)

      const changed = paneId !== activePaneId
      // A host holding an id the deck could not resolve is told even when
      // nothing moved, because the value it holds is the one that is wrong.
      const correctsHost =
        requestedActive !== undefined && paneId !== requestedActive

      if (changed || correctsHost) onActivePaneChange?.(paneId)
    },
    [activePane, activePaneId, onActivePaneChange, requestedActive],
  )

  const setMode = React.useCallback(
    (next: WindowDeckMode) => {
      if (mode === undefined) setUncontrolledMode(next)
      if (next !== resolvedMode) onModeChange?.(next)
    },
    [mode, onModeChange, resolvedMode],
  )

  const centerPane = React.useCallback(
    (paneId: string | undefined, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      const pane = paneElement(paneId)

      if (!viewport || !pane) return

      // The scroll the deck starts is not a selection the user made, so the
      // scroll handler stands down until it has finished travelling.
      const target = centeredScrollLeft(viewport, pane)

      // Already there. Scrolling to the current position moves nothing and so
      // may never report that it finished, which would leave scroll-driven
      // selection suppressed for the length of the fallback timer.
      if (Math.abs(viewport.scrollLeft - target) < 1) return

      // The token only ever counts up: a superseded release must be able to
      // tell that it is stale, which a reused number could not express.
      scrollTokenRef.current += 1
      const token = scrollTokenRef.current

      if (scrollReleaseTimerRef.current !== undefined) {
        window.clearTimeout(scrollReleaseTimerRef.current)
        scrollReleaseTimerRef.current = undefined
      }

      programmaticScrollRef.current = true
      viewport.scrollTo({ left: target, behavior })

      /** Hands scroll-driven selection back once the deck has stopped. */
      const release = () => {
        // Detached first and unconditionally: a superseded release that
        // returned early would leave its listener on the viewport for good.
        viewport.removeEventListener("scrollend", release)
        if (scrollTokenRef.current !== token) return
        if (scrollReleaseTimerRef.current !== undefined) {
          window.clearTimeout(scrollReleaseTimerRef.current)
          scrollReleaseTimerRef.current = undefined
        }
        programmaticScrollRef.current = false
      }

      viewport.addEventListener("scrollend", release)
      // Not every browser fires scrollend, and an instant scroll may finish
      // before the listener is attached, so a timer closes the window too.
      scrollReleaseTimerRef.current = window.setTimeout(
        release,
        behavior === "smooth" ? 700 : 0,
      )
    },
    [paneElement],
  )

  /**
   * Writes the strip's current scroll and the tile transforms that already
   * have that offset baked in, so a pane's CSS translate is the painted
   * position rather than a second layer the settle would fight.
   *
   * @param layout - The strip measured at scroll 0.
   * @param scroll - How far the strip has been panned.
   * @param paneOrder - Registered panes in visual order.
   */
  const applyOverviewScroll = React.useCallback(
    (
      layout: WindowDeckOverviewLayout,
      scroll: number,
      paneOrder: readonly RegisteredWindowDeckPane[],
    ) => {
      overviewScrollRef.current = scroll
      overviewStripRef.current = layout
      setOverviewScroll(scroll)
      setOverviewStrip(layout)

      const next = Object.fromEntries(
        paneOrder.map((pane, index) => [
          pane.id,
          {
            ...layout.tiles[index],
            x: layout.tiles[index].x - scroll,
          },
        ]),
      )

      setTiles((existing) => (sameTiles(existing, next) ? existing : next))
    },
    [],
  )

  /**
   * Measures the deck and lays every pane out on the overview strip.
   *
   * Measurement is taken from layout geometry rather than from painted
   * rectangles: the carousel already scales the unfocused panes, and a tile
   * transform replaces that scale rather than compounding with it. When the
   * live window sits past the first page, the strip is panned so that tile
   * is on screen before the first overview frame paints.
   *
   * @param centrePaneId - When given, pan so this tile sits in the middle.
   * Resize and re-tile keep the current offset, clamped to the new strip.
   * @returns Whether the deck has room to present an overview at all.
   */
  const measureTiles = React.useCallback((centrePaneId?: string) => {
    const viewport = viewportRef.current
    const current = panesRef.current

    if (!viewport || current.length === 0) return false

    // A close may still be settling. Its rail shift is a transform on the
    // panes' parent, so leaving it in flight would push the whole strip
    // sideways by however far the rail still had to travel. Finishing it now
    // also cancels its timer, which would otherwise fire after this
    // measurement and reset the scroller underneath the tiles.
    finishSettleRef.current?.()

    const rects: WindowDeckRect[] = current.map((pane) => ({
      left: pane.element.offsetLeft - viewport.offsetLeft - viewport.scrollLeft,
      top: pane.element.offsetTop - viewport.offsetTop,
      width: pane.element.offsetWidth,
      height: pane.element.offsetHeight,
    }))
    const layout = computeOverviewLayout(
      rects,
      { width: viewport.clientWidth, height: viewport.clientHeight },
      overviewOptions,
    )

    if (layout === null) return false

    const focusIndex = current.findIndex((pane) => pane.id === centrePaneId)
    const scroll =
      centrePaneId !== undefined && focusIndex >= 0
        ? overviewScrollToCentre(
            layout.centres[focusIndex].x,
            layout.contentWidth,
            viewport.clientWidth,
          )
        : clampOverviewScroll(
            overviewScrollRef.current,
            layout.contentWidth,
            viewport.clientWidth,
          )

    applyOverviewScroll(layout, scroll, current)
    return true
  }, [applyOverviewScroll, overviewOptions])

  /**
   * Pans the overview strip by a pointer or wheel delta.
   *
   * @param deltaX - How far to move the strip, in pixels. Positive reveals
   * tiles to the right.
   */
  const panOverview = React.useCallback(
    (deltaX: number) => {
      const viewport = viewportRef.current
      const layout = overviewStripRef.current
      const current = panesRef.current

      if (!viewport || !layout || current.length === 0) return

      const next = clampOverviewScroll(
        overviewScrollRef.current + deltaX,
        layout.contentWidth,
        viewport.clientWidth,
      )

      if (next === overviewScrollRef.current) return

      if (overviewPanTimerRef.current !== undefined) {
        window.clearTimeout(overviewPanTimerRef.current)
      }
      setOverviewPanning(true)
      overviewPanTimerRef.current = window.setTimeout(() => {
        overviewPanTimerRef.current = undefined
        if (mountedRef.current) setOverviewPanning(false)
      }, 120)
      applyOverviewScroll(layout, next, current)
    },
    [applyOverviewScroll],
  )

  /**
   * Scrolls the overview so the named tile is fully on screen, leaving the
   * offset alone when it already is.
   *
   * @param paneId - The tile to reveal.
   */
  const revealOverviewTile = React.useCallback(
    (paneId: string | undefined) => {
      const viewport = viewportRef.current
      const layout = overviewStripRef.current
      const current = panesRef.current
      const index = current.findIndex((pane) => pane.id === paneId)

      if (!viewport || !layout || index < 0) return

      const next = overviewScrollToReveal(
        layout.centres[index].x,
        layout.tileWidth,
        layout.contentWidth,
        viewport.clientWidth,
        overviewScrollRef.current,
      )

      if (next === overviewScrollRef.current) return
      applyOverviewScroll(layout, next, current)
    },
    [applyOverviewScroll],
  )

  const openOverview = React.useCallback(() => {
    const viewport = viewportRef.current

    // A smooth scroll still in flight would be measured as a moving
    // scrollLeft, and the remaining travel would shift the whole grid.
    if (viewport) {
      viewport.scrollTo({ left: viewport.scrollLeft, behavior: "instant" })
      programmaticScrollRef.current = false
    }
    // The window the carousel is on now, not the one a previous visit
    // restored to. Leaving restore stale here would centre the strip — and
    // mount the live tree — on a window the user already left.
    const live = activePaneIdRef.current
    // A deck with no room for a strip stays a carousel: an overview whose
    // tiles cannot be read is one where the panes have not moved.
    if (!measureTiles(live)) return
    setRestore(live)
    setMode("overview")
  }, [measureTiles, setMode, setRestore])

  const closeOverview = React.useCallback(
    (paneId?: string) => {
      const landing = paneId ?? restoreRef.current ?? activePaneId

      if (landing === undefined) {
        setMode("carousel")
        return
      }
      // The jump itself happens in a layout effect keyed on the mode, so a
      // host that drives the mode itself gets the same settle this does.
      pendingSettleRef.current = landing
      setActive(landing)
      setMode("carousel")
    },
    [activePaneId, setActive, setMode],
  )

  const selectPane = React.useCallback(
    (paneId: string) => {
      if (resolvedMode === "overview") {
        closeOverview(paneId)
        return
      }
      fromScrollRef.current = false
      setActive(paneId)
      if (paneId === activePaneId) centerPane(paneId, "smooth")
    },
    [activePaneId, centerPane, closeOverview, resolvedMode, setActive],
  )

  /**
   * Takes a pane's word that it has finished leaving.
   *
   * Nothing is announced or refocused here: `onDismiss` is a request, and a
   * host is free to decline it. The deck acts only once the pane has
   * actually left the deck, which the effect below watches for.
   */
  const reportDismissal = React.useCallback(
    (paneId: string, outcome: "left" | "retained") => {
      setDismissRequest(undefined)

      if (outcome === "retained") {
        // The pane is still mounted, which usually means the host declined.
        // It may equally mean the host is waiting on a confirmation or a
        // request before removing it, and those two are indistinguishable
        // except by time — so the record is kept briefly rather than dropped
        // at once. A removal that lands inside the window is still announced
        // and still rescues focus; after it, the pane is treated as kept and
        // nothing is left behind to fire against an unrelated removal later.
        const timers = retainedTimersRef.current

        window.clearTimeout(timers.get(paneId))
        timers.set(
          paneId,
          window.setTimeout(() => {
            timers.delete(paneId)
            pendingRemovalsRef.current.delete(paneId)
          }, RETAINED_GRACE_MS),
        )
        return
      }

      window.clearTimeout(retainedTimersRef.current.get(paneId))
      retainedTimersRef.current.delete(paneId)

      const current = panesRef.current
      const index = current.findIndex((pane) => pane.id === paneId)

      // Keyed by pane, because two panes thrown in quick succession are both
      // in flight before either removal has committed. Whether the pane was
      // the focused one is recorded now: by the time the removal lands the
      // deck has already fallen back to another window, so asking then would
      // never find it.
      pendingRemovalsRef.current.set(paneId, {
        wasActive: activePaneIdRef.current === paneId,
        neighbour:
          index === -1
            ? undefined
            : (current[index + 1] ?? current[index - 1])?.id,
        name: current[index]?.element.getAttribute("aria-label") ?? paneId,
      })
    },
    [],
  )

  // A pane the host actually removed leaves a hole in the deck: focus was on
  // it, selection may have named it, and the removal is worth announcing.
  React.useEffect(() => {
    const pending = pendingRemovalsRef.current

    if (pending.size === 0) return

    const removed: { neighbour: string | undefined; name: string }[] = []

    for (const [paneId, removal] of pending) {
      if (paneIds.includes(paneId)) continue
      pending.delete(paneId)
      removed.push(removal)

      const neighbour =
        removal.neighbour !== undefined && paneIds.includes(removal.neighbour)
          ? removal.neighbour
          : undefined

      if (restoreRef.current === paneId) setRestore(neighbour)
      if (removal.wasActive && neighbour !== undefined) {
        correctedFromRemovalRef.current = true
        setActive(neighbour)
      }
    }

    if (removed.length === 0) return
    // Every window that left is named: two thrown in quick succession are
    // one commit apart, and reporting only the last would lose the other.
    setAnnouncement(
      removed.map((entry) => labels.paneDismissed(entry.name)).join(", "),
    )

    // Rescue only when focus fell to the document. A host that moved it to
    // a toast, a dialog, or an undo control is not "dropped"; stealing it
    // back would be the bug the comment used to claim we avoided.
    const root = rootRef.current

    if (root === null) return
    if (!isDocumentFocus(root.ownerDocument, root.ownerDocument.activeElement)) {
      return
    }

    const neighbour = removed[0].neighbour
      ? paneElement(removed[0].neighbour)
      : undefined

    // The deck itself is the last resort, so the keyboard never lands back
    // at the top of the document because the deck emptied.
    ;(neighbour ?? root).focus()
  }, [activePaneId, labels, paneElement, paneIds, setActive, setRestore])

  /**
   * Returns the deck from the overview without a visible seam.
   *
   * The scroller is jumped to the landing pane and the rail is shifted by the
   * same distance in the same frame, so the composite is pixel-identical and
   * nothing flashes. The rail then transitions its shift away on the same
   * curve the panes use to leave their tiles, which reads as one movement.
   */
  React.useLayoutEffect(() => {
    const previous = previousModeRef.current
    previousModeRef.current = resolvedMode

    if (resolvedMode === "overview") {
      // Whichever route opened the overview, the window the deck came from
      // is the one a dismissal returns to.
      if (previous !== "overview") {
        const restoreId = activePaneIdRef.current
        setRestore(restoreId)
        const restore = paneElement(restoreId)
        const root = rootRef.current
        const active = root?.ownerDocument.activeElement ?? null

        // Opening the overview inerts every pane's content, which drops
        // keyboard focus onto the document. Put it on the restore tile so
        // Enter, Delete, and the next Tab have a target.
        if (
          restore &&
          root &&
          (isDocumentFocus(root.ownerDocument, active) || !restore.contains(active))
        ) {
          restore.focus({ preventScroll: true })
        }
      }
      // The deck is in the overview, so any close that was requested did not
      // happen; a landing left armed here would settle a later close onto
      // the wrong window.
      pendingSettleRef.current = undefined
      return
    }
    if (previous !== "overview") return

    // Read through the ref so a controlled host echoing the landing id a
    // commit later does not re-run this effect and finish the settle mid-slide.
    const landing = pendingSettleRef.current ?? activePaneIdRef.current
    pendingSettleRef.current = undefined

    const viewport = viewportRef.current
    const rail = railRef.current
    const pane = paneElement(landing)

    if (!viewport || !rail || !pane) return

    const before = viewport.scrollLeft
    // Both of the scroller's carousel behaviours have to be off before the
    // jump, and a class cannot do it: this effect runs in the commit that
    // restored them, and turning them off through state would land a frame
    // too late.
    //
    // Smooth scrolling would make the write below an animation that reads
    // back the position it has not left yet, so the shift would compute to
    // zero and the seam this mechanism exists to hide is what the user sees.
    // Snapping is worse: snap areas are measured from transformed boxes, so
    // shifting the rail moves every snap position with it and the browser
    // re-snaps at once, landing the deck a whole window along.
    viewport.style.scrollBehavior = "auto"
    viewport.style.scrollSnapType = "none"
    // The shift is written with transitions suppressed; only its removal is
    // allowed to animate.
    rail.style.transitionProperty = "none"
    viewport.scrollLeft = centeredScrollLeft(viewport, pane)
    const settled = viewport.scrollLeft
    const shift = settled - before
    rail.style.translate = `${shift}px`
    // Reading layout is the flush: it forces the shift to be computed, so the
    // line below has a value to transition from.
    void rail.getBoundingClientRect()
    rail.style.removeProperty("transition-property")
    rail.style.translate = "0px"
    pane.focus({ preventScroll: true })

    const duration = longestTransitionMs(pane)
    const railMoved = Math.abs(shift) >= 1
    let timer: number | undefined

    /**
     * Ends the settle when the movement it is waiting on finishes.
     *
     * Escape lands on the window the scroller already centred, so the rail
     * shift is zero and never fires `transitionend`. That path waits on the
     * landing pane's own return instead.
     *
     * @param event - The transition that ended.
     */
    const onSettled = (event: TransitionEvent) => {
      if (railMoved) {
        if (event.target !== rail || event.propertyName !== "translate") return
      } else if (
        event.target !== pane ||
        (event.propertyName !== "translate" &&
          event.propertyName !== "scale" &&
          event.propertyName !== "opacity")
      ) {
        return
      }
      finish()
    }

    /** Hands the scroller back its snapping once nothing is transformed. */
    const finish = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      rail.removeEventListener("transitionend", onSettled)
      pane.removeEventListener("transitionend", onSettled)
      finishSettleRef.current = null
      // Suppress the rail's own curve so finishing mid-slide — an open that
      // cancelled this settle — snaps rather than animating under the grid.
      rail.style.transitionProperty = "none"
      rail.style.removeProperty("translate")
      void rail.getBoundingClientRect()
      rail.style.removeProperty("transition-property")
      viewport.style.removeProperty("scroll-behavior")
      viewport.style.removeProperty("scroll-snap-type")
      // Snap areas are computed from transformed boxes; re-enabling snap
      // before the panes are untransformed makes the browser jump to a
      // neighbour. Restoring the offset keeps that handover invisible.
      viewport.scrollLeft = settled
      settlingRef.current = false
      // Skipped only for a real unmount. This cleanup also runs on an
      // ordinary dependency change — a mode change that cancelled the settle
      // — and skipping the write there would latch the deck settling.
      if (mountedRef.current) setSettling(false)
    }

    if (duration === 0) {
      finish()
      return
    }

    settlingRef.current = true
    setSettling(true)
    finishSettleRef.current = finish
    // The movement that actually runs is what the settle waits on; the
    // timer is only a backstop for the cases a transition never reports —
    // a hidden tab, an interrupted animation. Its margin is generous on
    // purpose: finishing early re-enables snapping while the panes are
    // still transformed, and the browser then snaps to a box that is still
    // moving.
    ;(railMoved ? rail : pane).addEventListener("transitionend", onSettled)
    timer = window.setTimeout(finish, duration + 200)

    // An unmount, or another mode change, must not strand the rail at its
    // shift: the settle is finished outright rather than merely abandoned.
    return () => {
      if (finishSettleRef.current === finish) finish()
    }
  }, [paneElement, resolvedMode, setRestore])



  // Panes register on mount, so a host that reorders them without changing
  // the set would otherwise keep the order they first mounted in — which is
  // the order the overview tiles them in and the arrows walk through.
  React.useLayoutEffect(() => {
    setPanes((current) => {
      // Checked in one pass before anything is allocated: this runs on every
      // commit, including the ones a scroll produces.
      const ordered = current.every(
        (pane, index) =>
          index === 0 ||
          (current[index - 1].element.compareDocumentPosition(pane.element) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
            0,
      )

      return ordered ? current : sortByDocumentPosition(current)
    })
  })

  // A pane the host removed on its own leaves the uncontrolled selection
  // naming a window that is gone. Left alone, selection would snap back to
  // it if a pane ever mounted under that id again.
  React.useEffect(() => {
    if (activePane !== undefined || uncontrolledActive === undefined) return
    if (paneIds.length === 0 || paneIds.includes(uncontrolledActive)) return
    // Not yet mounted. A defaultActivePane behind Suspense is unresolved,
    // not gone, and rewriting it to the first registered pane loses it.
    if (!seenPaneIdsRef.current.has(uncontrolledActive)) return
    // Functional, so a selection a dismissal has already queued wins: that
    // one names the neighbour of the window that left, which is where the
    // user was, and this one only exists to unstick a dead id.
    setUncontrolledActive((current) =>
      current !== undefined && paneIds.includes(current) ? current : activePaneId,
    )
  }, [activePane, activePaneId, paneIds, uncontrolledActive])

  // A host holding an id the deck no longer has is told, rather than left to
  // discover that the deck quietly moved on without it.

  // Every route into the overview lands here — the shortcut, a host driving
  // the mode itself, a pane leaving the grid — so the tiles are laid out
  // before the frame is painted whichever way it opened. `panes` in the deps
  // is what re-tiles the grid over the gap a dismissal leaves.
  React.useLayoutEffect(() => {
    if (resolvedMode !== "overview") {
      overviewStripRef.current = null
      setOverviewStrip((current) => (current === null ? current : null))
      return
    }
    // A deck that opens in the overview must be centred before the tiles are
    // measured: otherwise every x is off by the landing pane's scrollLeft
    // and the strip slides sideways a frame later.
    if (!centeredRef.current && panes.length > 0) {
      centeredRef.current = true
      centerPane(activePaneId, "instant")
    }
    // A host may put the deck into the overview itself, so the guard that
    // keeps an unreadable strip off the screen lives here rather than only
    // in the shortcut: without it the panes sit untransformed in a scroller
    // that no longer pans. Centring runs only on the way in; a resize or a
    // dismissal keeps the current offset.
    const entering = overviewStripRef.current === null
    if (entering && activePaneId !== undefined) setRestore(activePaneId)
    if (measureTiles(entering ? activePaneId : undefined)) {
      forcedCarouselRef.current = false
      // A deck that opened straight into the overview has no earlier
      // carousel commit to have seeded the window it returns to.
      if (restoreRef.current === undefined && activePaneId !== undefined) {
        setRestore(activePaneId)
      }
      return
    }
    if (panes.length === 0 || forcedCarouselRef.current) return
    // Latched, so a host that answers onModeChange by re-rendering without
    // changing the mode is asked once rather than on every render it causes.
    // The mode effect has already recorded "overview"; rewind that so the
    // forced close does not play a settle for a grid that never appeared.
    forcedCarouselRef.current = true
    previousModeRef.current = "carousel"
    setMode("carousel")
  }, [activePaneId, centerPane, measureTiles, panes, resolvedMode, setMode, setRestore])

  React.useEffect(() => {
    if (requestedActive === undefined || activePaneId === undefined) return
    if (!paneIds.length) return
    if (requestedActive === activePaneId) {
      // The host already holds a live id — including the neighbour a
      // dismissal just selected — so the one-shot skip is spent.
      correctedFromRemovalRef.current = false
      return
    }
    if (!seenPaneIdsRef.current.has(requestedActive)) return
    if (correctedFromRemovalRef.current) {
      correctedFromRemovalRef.current = false
      return
    }
    onActivePaneChange?.(activePaneId)
  }, [activePaneId, onActivePaneChange, paneIds.length, requestedActive])

  // Announced on the mode's own change, not on every render that follows
  // it — but a deck whose panes have not registered yet has nothing true to
  // say, so the announcement waits for them rather than reporting an empty
  // overview it will never correct.
  const announcedRef = React.useRef<string | undefined>(undefined)

  React.useEffect(() => {
    if (paneIds.length === 0) return

    const signature = `${resolvedMode}:${paneIds.length}`

    if (announcedRef.current === signature) return
    const wasAnnounced = announcedRef.current

    announcedRef.current = signature
    // Nothing has changed yet on the first pass: a deck must not narrate
    // itself into the live region simply for being on the page.
    if (wasAnnounced === undefined) return
    // Only the mode's own change is announced. A changing pane count while
    // the overview stays open is a dismissal, which announces itself.
    if (wasAnnounced?.split(":")[0] === resolvedMode) return

    setAnnouncement(
      resolvedMode === "overview"
        ? labels.overviewOpened(paneIds.length)
        : activePaneId === undefined
          ? ""
          : labels.overviewClosed(
              paneElement(activePaneId)?.getAttribute("aria-label") ??
                activePaneId,
            ),
    )
  }, [activePaneId, labels, paneElement, paneIds.length, resolvedMode])

  // The opening view is centred without animation: there is no previous
  // position for the deck to have travelled from.
  React.useLayoutEffect(() => {
    if (centeredRef.current || panes.length === 0) return
    centeredRef.current = true
    centerPane(activePaneId, "instant")
  }, [activePaneId, centerPane, panes.length])

  // A selection made anywhere but the scroller — a shortcut, a tile, the
  // host — brings its pane to the middle.
  React.useEffect(() => {
    if (resolvedMode !== "carousel" || settling || settlingRef.current) return
    if (fromScrollRef.current) {
      fromScrollRef.current = false
      return
    }
    if (!centeredRef.current) return

    centerPane(
      activePaneId,
      window.matchMedia(reducedMotionQuery).matches ? "instant" : "smooth",
    )
  }, [activePaneId, centerPane, resolvedMode, settling])

  // The overview is measured from the deck's own box, so a host that resizes
  // it — a window resize, a sidebar opening — re-tiles rather than leaving
  // the grid laid out for the old size.
  React.useEffect(() => {
    const viewport = viewportRef.current

    if (resolvedMode !== "overview" || !viewport) return

    const observer = new ResizeObserver(() => {
      if (measureTiles()) forcedCarouselRef.current = false
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [measureTiles, resolvedMode])

  React.useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current)
      }
    },
    [],
  )

  // The keymap and everything the handler reads live in a ref, so the window
  // listener is attached once rather than re-attached on every render — a
  // host writing `shortcuts={{ ... }}` inline would otherwise tear the
  // listener down and rebuild it on every scroll frame.
  const keymap = resolveWindowDeckShortcuts(shortcuts)
  const handleKeyDownRef = React.useRef<(event: KeyboardEvent) => void>(
    () => {},
  )

  handleKeyDownRef.current = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.isComposing) return
    if (handledShortcutEvents.has(event)) return

    // Only this deck's own keystrokes count, so two decks on one page never
    // fight over a shortcut. When nothing is focused the first deck takes it,
    // as the user is addressing the page.
    const root = rootRef.current
    const target = event.target
    const insideDeck =
      root !== null && target instanceof Node && root.contains(target)
    const nothingFocused =
      !(target instanceof HTMLElement) ||
      target === target.ownerDocument.body ||
      target === target.ownerDocument.documentElement

    if (!insideDeck && !nothingFocused) return

    /** Claims the event so no other handler answers the same keystroke. */
    const claim = (preventDefault: boolean | undefined) => {
      handledShortcutEvents.add(event)
      if (preventDefault !== false) event.preventDefault()
    }

    // Escape leaves the overview whatever the keymap says: it is the
    // dismissal every layered view in the system answers to.
    if (event.key === "Escape" && resolvedMode === "overview") {
      claim(true)
      closeOverview()
      return
    }

    if (keymap === false) return

    if (matchesWindowDeckShortcut(event, keymap.toggleOverview)) {
      claim(
        keymap.toggleOverview === false
          ? undefined
          : keymap.toggleOverview.preventDefault,
      )
      if (resolvedMode === "overview") closeOverview()
      else openOverview()
      return
    }

    if (
      resolvedMode === "overview" &&
      matchesWindowDeckShortcut(event, keymap.dismissPane)
    ) {
      // The tile the user is on, not the one the deck happens to have
      // focused: in the overview every tile is a focus stop, and destroying
      // a different window than the one under the cursor is unrecoverable.
      const focused = panesRef.current.find(
        (pane) =>
          target instanceof Node &&
          (pane.element === target || pane.element.contains(target)),
      )
      const pane = focused ?? panesRef.current.find((p) => p.id === activePaneId)

      if (pane?.element.hasAttribute("data-dismissible")) {
        claim(
          keymap.dismissPane === false
            ? undefined
            : keymap.dismissPane.preventDefault,
        )
        dismissNonceRef.current += 1
        setDismissRequest({ paneId: pane.id, nonce: dismissNonceRef.current })
        return
      }
    }

    const step = matchesWindowDeckShortcut(event, keymap.nextPane)
      ? 1
      : matchesWindowDeckShortcut(event, keymap.previousPane)
        ? -1
        : 0

    if (step === 0) return
    // Cmd/Ctrl+Arrow is line-start / word-jump inside a composer. The
    // matcher still reports the chord so a host can rebind it; the deck
    // itself must not steal it while the user is typing, and must not
    // retarget a settle that is still sliding.
    if (isEditableShortcutTarget(event) || settlingRef.current) return

    const shortcut = step === 1 ? keymap.nextPane : keymap.previousPane
    claim(shortcut === false ? undefined : shortcut.preventDefault)

    const index = paneIds.indexOf(activePaneId ?? "")
    const next = paneIds[Math.min(Math.max(index + step, 0), paneIds.length - 1)]

    if (next === undefined) return
    // In the overview the shortcut moves the tile the user is on, so the
    // keyboard and the pointer address the same set of targets.
    if (resolvedMode === "overview") {
      paneElement(next)?.focus()
      revealOverviewTile(next)
    }
    fromScrollRef.current = false
    setActive(next)
  }

  React.useEffect(() => {
    /** Delegates to the current handler, which every render refreshes. */
    const listener = (event: KeyboardEvent) => handleKeyDownRef.current(event)

    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])

  /** Follows the scroller, so the centred window is the focused one. */
  const handleScroll = () => {
    const viewport = viewportRef.current

    if (
      resolvedMode !== "carousel" ||
      settling ||
      programmaticScrollRef.current ||
      !viewport ||
      scrollFrameRef.current !== null
    ) {
      return
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null

      const centre = viewport.scrollLeft + viewport.clientWidth / 2
      const closest = panesRef.current.reduce<{ id?: string; distance: number }>(
        (best, pane) => {
          const distance = Math.abs(
            pane.element.offsetLeft -
              viewport.offsetLeft +
              pane.element.offsetWidth / 2 -
              centre,
          )

          return distance < best.distance ? { id: pane.id, distance } : best
        },
        { distance: Number.POSITIVE_INFINITY },
      )

      if (closest.id === undefined || closest.id === activePaneId) return
      fromScrollRef.current = true
      setActive(closest.id)
    })
  }

  const liveContentId =
    resolvedMode === "overview"
      ? (restoreRef.current ?? restorePaneId ?? activePaneId)
      : activePaneId

  const shouldMountContent = React.useCallback(
    (paneId: string) => contentMount === "always" || paneId === liveContentId,
    [contentMount, liveContentId],
  )

  const shouldMountPreview = React.useCallback(
    (paneId: string) => {
      if (contentMount === "always" || resolvedMode !== "overview") return false
      if (paneId === liveContentId) return false
      const layout = overviewStrip
      const viewport = viewportRef.current
      if (!layout || !viewport) return false
      const index = paneIds.indexOf(paneId)
      if (index < 0) return false

      return overviewPreviewInView(
        layout.centres[index].x,
        layout.tileWidth,
        overviewScroll,
        viewport.clientWidth,
      )
    },
    [
      contentMount,
      liveContentId,
      overviewScroll,
      overviewStrip,
      paneIds,
      resolvedMode,
    ],
  )

  React.useLayoutEffect(() => {
    if (paneHeight !== "auto") return
    const pane = paneElement(liveContentId)
    if (!pane) return

    const commit = (height: number) => {
      if (height > 0) {
        setMeasuredPaneHeight((current) => (current === height ? current : height))
      }
    }

    commit(pane.offsetHeight)
    const observer = new ResizeObserver(() => commit(pane.offsetHeight))
    observer.observe(pane)
    return () => observer.disconnect()
  }, [liveContentId, paneElement, paneHeight, panes])

  const contextValue = React.useMemo(
    () => ({
      activePaneId,
      dismissRequest,
      mode: resolvedMode,
      overviewPanning,
      paneIds,
      panOverview,
      registerPane,
      reportDismissal,
      restorePaneId,
      selectPane,
      settling,
      shouldMountContent,
      shouldMountPreview,
      tileFor: (paneId: string) => tiles[paneId],
    }),
    [
      activePaneId,
      dismissRequest,
      overviewPanning,
      paneIds,
      panOverview,
      registerPane,
      reportDismissal,
      resolvedMode,
      restorePaneId,
      selectPane,
      settling,
      shouldMountContent,
      shouldMountPreview,
      tiles,
    ],
  )

  return (
    <WindowDeckContext.Provider value={contextValue}>
      <div
        {...props}
        ref={composedRef}
        data-slot="window-deck"
        data-mode={resolvedMode}
        data-content-mount={contentMount}
        // Focusable only as the landing place for focus a dismissal
        // dropped; it is not a tab stop of its own.
        tabIndex={-1}
        style={
          {
            ...style,
            "--nessa-window-deck-pane-width": paneWidth,
            "--nessa-window-deck-pane-height":
              paneHeight === "auto" && measuredPaneHeight !== undefined
                ? `${measuredPaneHeight}px`
                : paneHeight,
          } as React.CSSProperties
        }
        className={cn("relative isolate h-full w-full", className)}
      >
        <div
          ref={viewportRef}
          data-slot="window-deck-viewport"
          data-settling={settling ? "" : undefined}
          data-overview-overflow={
            resolvedMode === "overview" &&
            overviewStrip !== null &&
            overviewStrip.centres.length > overviewStrip.visibleCount
              ? ""
              : undefined
          }
          onScroll={handleScroll}
          onWheel={(event) => {
            const viewport = viewportRef.current

            if (!viewport || settling) return

            if (resolvedMode === "overview") {
              const layout = overviewStripRef.current
              if (!layout || layout.contentWidth <= viewport.clientWidth) return
              const delta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY)
                  ? event.deltaX
                  : event.deltaY
              if (delta === 0) return
              event.preventDefault()
              panOverview(delta)
              return
            }

            if (
              !wheelNavigation ||
              Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
              hasScrollableAncestor(event.target, viewport)
            ) {
              return
            }

            // Explicitly instant: the scroller carries `scroll-smooth` for
            // its own centring, and a wheel tick that animated would read
            // back a mid-flight position and under-travel on the next one.
            viewport.scrollBy({ left: event.deltaY, behavior: "instant" })
          }}
          className={cn(
            "h-full w-full overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // The carousel is a snapping scroller. The overview pans the
            // strip through tile transforms rather than the scroller: a snap
            // computed from those transforms would drag the deck sideways.
            // A container, so the end spacers can be sized against the deck's
            // own width rather than against the rail's intrinsic one.
            "@container",
            resolvedMode === "carousel"
              ? "snap-x snap-mandatory overflow-x-auto scroll-smooth motion-reduce:scroll-auto"
              : "overflow-x-hidden [scroll-snap-type:none]",
            settling && "overflow-x-hidden scroll-auto [scroll-snap-type:none]",
          )}
        >
          <div
            ref={railRef}
            data-slot="window-deck-rail"
            // The rail rides the same curve and duration as the panes: the
            // two are one movement, and any difference between them shows up
            // as the seam the settle exists to hide.
            className={cn(
              "flex h-full w-max items-center gap-6 py-6 transition-[translate] [transition-duration:calc(var(--nessa-motion-duration-slow)*1.5)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
              settling &&
                "[will-change:transform] motion-reduce:[will-change:auto]",
            )}
          >
            {/*
              Real items rather than padding on the rail: a scroll container
              does not extend its scrollable range to cover a flex
              container's trailing padding, which leaves the last pane a
              half-viewport short of the middle and the settle unable to
              centre it. Sized in container units so the measurement is the
              deck's width, not the rail's own intrinsic width.
            */}
            <div
              aria-hidden="true"
              data-slot="window-deck-rail-spacer"
              className="w-[max(1rem,calc((100cqw-var(--nessa-window-deck-pane-width))/2))] shrink-0 self-stretch"
            />
            {children}
            <div
              aria-hidden="true"
              data-slot="window-deck-rail-spacer"
              className="w-[max(1rem,calc((100cqw-var(--nessa-window-deck-pane-width))/2))] shrink-0 self-stretch"
            />
          </div>
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          data-slot="window-deck-announcement"
          className="sr-only"
        >
          {announcement}
        </div>
      </div>
    </WindowDeckContext.Provider>
  )
}

export {
  WindowDeck,
  windowDeckDefaultLabels,
  type WindowDeckLabels,
  type WindowDeckProps,
}
