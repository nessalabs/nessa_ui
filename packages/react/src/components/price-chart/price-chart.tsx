"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  priceChartAreaPath,
  priceChartBarValue,
  priceChartCandles,
  priceChartGeometry,
  priceChartHasCandles,
  priceChartIndexAt,
  priceChartLinePath,
  priceChartNormalizeSelection,
  priceChartPointX,
  priceChartSelectionBounds,
  priceChartSelectionChange,
  priceChartSeriesTone,
  priceChartTimeTicks,
  priceChartValueTicks,
  priceChartValueY,
  type PriceChartBar,
  type PriceChartSelection,
  type PriceChartTone,
  type PriceChartView,
} from "./price-chart-math"

/**
 * The strings PriceChart produces itself, so hosts can localize them. Merge
 * partial overrides over `priceChartDefaultLabels` through the `labels` prop.
 */
export interface PriceChartLabels {
  /**
   * Names the plot when it is not scrubbable and the host supplies no
   * `aria-label` — the labelled-image form a sparkline takes.
   */
  chart: string
  /**
   * Shown in place of the plot when the series is empty, and read as the
   * cursor's value while there is nothing to scrub.
   */
  empty: string
  /**
   * Names the scrub cursor for assistive technology when the host passes no
   * `aria-label`. A host that does pass one names the cursor with it: the
   * cursor is the chart's primary control, so the chart's name is the one
   * worth hearing on it.
   */
  cursor: string
  /** Names the control that returns a zoomed chart to the full series. */
  clearSelection: string
  /**
   * Describes the window gesture on the cursor, so a person who cannot see
   * the plot still learns the chart can be zoomed. Rendered off-screen and
   * referenced by the cursor's `aria-describedby`.
   */
  selectionHint: string
  /**
   * Names the window being drawn, as part of the cursor's announced value —
   * the band itself is drawn, so this is what a person who cannot see it
   * hears while it grows. Receives the formatted span.
   */
  selecting: (span: string) => string
  /** Announces a committed window. Receives the formatted span. */
  zoomed: (span: string) => string
  /** Announces a return to the full series. */
  cleared: string
}

/** The out-of-the-box English strings. */
export const priceChartDefaultLabels: PriceChartLabels = Object.freeze({
  chart: "Price chart",
  empty: "No price data",
  cursor: "Price cursor",
  clearSelection: "Clear selection",
  selectionHint:
    "Drag across the chart, or hold Shift and press the arrow keys and then Enter, to zoom into a window. Escape returns to the full series.",
  selecting: (span: string) => `Selecting ${span}`,
  zoomed: (span: string) => `Zoomed to ${span}`,
  cleared: "Showing the full series",
})

/**
 * The market colour for a direction, as a text class so anything inside it —
 * SVG paint through `currentColor`, a change line, a legend swatch — takes it
 * without naming the token again. Exported because a host or a sibling panel
 * showing the same reading has to be able to match the chart exactly.
 */
export const priceChartToneVariants = cva("", {
  variants: {
    tone: {
      gain: "text-(--nessa-market-gain)",
      loss: "text-(--nessa-market-loss)",
      neutral: "text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
})

const toneTextClass = (tone: PriceChartTone) => priceChartToneVariants({ tone })

/**
 * A selected window with everything a host needs to act on it: the bars at
 * each end and the move across them.
 */
export interface PriceChartSelectionContext extends PriceChartSelection {
  /** The bar at the earlier edge. */
  startBar: PriceChartBar
  /** The bar at the later edge. */
  endBar: PriceChartBar
  /** The price move from the first plotted price of the window to the last. */
  changeAmount: number
  /** That same move as a percentage of the window's opening price. */
  changePercent: number
}

/**
 * The measured content box of an element, or `null` before the first
 * measurement. The same hook RadarChart and PieChart carry, plus one
 * synchronous first measurement — see the comment below for why this chart
 * needs it. Lifting the three into one shared module means adopting that
 * measurement everywhere, which is strictly safer than the observer-only
 * form; nothing else about them differs.
 */
function useMeasuredBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(
    null,
  )
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // Measured once before subscribing, unlike the observer-only copies in
    // RadarChart and PieChart: this plot resolves pointer positions against
    // its own width, so a press landing between first paint and the
    // observer's first callback would resolve every position to bar zero.
    const initial = element.getBoundingClientRect()
    setBox((previous) =>
      previous ??
      { width: Math.round(initial.width), height: Math.round(initial.height) },
    )
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]!.contentRect
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setBox((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return box
}

export interface PriceChartProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  /**
   * The observations to plot, oldest first. A bar carrying no price is a gap
   * — the line breaks around it rather than drawing through it — and the
   * candle view skips any bar without a full open/high/low/close set, so a
   * partial stream renders what it has instead of failing.
   */
  series: readonly PriceChartBar[]
  /**
   * Whether to draw a continuous price line or one candle per bar. A candle
   * view falls back to the line when the series carries no open/high/low/
   * close set, so a host may offer the toggle without gating it on the data.
   */
  view?: PriceChartView
  /**
   * The reference price drawn as a dotted rule — a previous close, a cost
   * basis, an alert level — and the comparison the automatic tone measures
   * against. It widens the plotted range so it always stays on screen, but
   * only for the whole series: a zoomed window is scaled to its own prices
   * and both the rule and the tone step aside if the reference falls outside
   * it, rather than flattening the window against a distant number.
   */
  baseline?: number
  /**
   * Forces the market color instead of deriving it from what is plotted.
   * Leave it unset for the usual behavior: green while the last plotted
   * price is above the baseline, red below — and, while a window is zoomed,
   * above or below that window's own first price.
   */
  tone?: PriceChartTone
  /**
   * Fades a tone-colored wash from the line down to the bottom edge. Off by
   * default, and inert in the candle view, which has no line to fill under.
   */
  fill?: boolean
  /**
   * Marks the newest bar of the series with a pulsing dot for a streaming
   * quote. Off by default, and hidden while a zoom is showing a window that
   * does not reach the newest bar.
   */
  live?: boolean
  /** Controlled index of the scrubbed bar; `null` clears the cursor. */
  scrubIndex?: number | null
  /** Initial scrub index when uncontrolled. Defaults to no cursor. */
  defaultScrubIndex?: number | null
  /**
   * Fires as the cursor moves across bars, with `null` when it leaves. This
   * is how a host mirrors the scrubbed price in its own header.
   */
  onScrubChange?: (index: number | null) => void
  /**
   * Whether the plot carries a cursor at all. Defaults to `true`; passing
   * `false` drops the interactive overlay and exposes the plot as a single
   * labelled image, which also disables `selectable` — the window gesture
   * lives on that same overlay.
   */
  scrubbable?: boolean
  /**
   * Whether dragging across the plot selects a window to zoom into.
   * Defaults to `true`. The drag draws a shaded band with a running summary;
   * releasing it re-plots the chart on that window alone, and the clear
   * control or Escape returns to the full series. Requires `scrubbable`.
   */
  selectable?: boolean
  /**
   * Controlled zoom window, as inclusive indices into `series`. `null` plots
   * the whole series. The chart's own clear control appears only when the
   * window gesture is available, so a chart driven this way with
   * `scrubbable={false}` owns the way back out itself.
   */
  selection?: PriceChartSelection | null
  /** Initial zoom window when uncontrolled. */
  defaultSelection?: PriceChartSelection | null
  /**
   * Fires when a window is zoomed into or cleared, carrying the window's
   * bars and the move across it — everything a host needs to report that
   * span or fetch it at a finer resolution.
   */
  onSelectionChange?: (selection: PriceChartSelectionContext | null) => void
  /** Formats the percentage move shown on a selection summary. */
  formatPercent?: (percent: number) => string
  /**
   * Whether to print the price scale down the right edge and the time scale
   * along the bottom. On by default; both re-read the plotted window, so
   * zooming re-labels them. Turn them off for sparkline-sized charts.
   */
  axes?: boolean
  /**
   * Formats a timestamp for the bottom scale, where a compact label
   * (`10:30`, `Aug 27`) reads better than the cursor's full one. Defaults to
   * `formatTime`.
   */
  formatAxisTime?: (time: number) => string
  /** Formats a price for the right-hand scale. Defaults to `formatValue`. */
  formatAxisValue?: (value: number) => string
  /** Formats a price for the cursor's announcement. */
  formatValue?: (value: number) => string
  /**
   * Formats a bar's timestamp for the cursor's announcement and the
   * selection summary.
   */
  formatTime?: (time: number) => string
  /** Overrides for the strings the chart itself produces. */
  labels?: Partial<PriceChartLabels>
  /**
   * Rendered under the plot and its scales — the slot for a legend or a
   * caption that should sit inside the chart's own box.
   */
  children?: React.ReactNode
}

const defaultFormatValue = (value: number) => value.toFixed(2)
const defaultFormatTime = (time: number) => new Date(time).toLocaleString()
const defaultFormatPercent = (percent: number) =>
  `${percent < 0 ? "\u2212" : "+"}${Math.abs(percent).toFixed(2)}%`

/** How far a pointer must travel before a press becomes a window drag. */
const SELECTION_THRESHOLD = 6

/**
 * A price plot in the language brokerage apps use: one hairline stroke in the
 * market's color, a dotted reference rule, a price scale down the right edge
 * over faint gridlines, a time scale along the bottom, and a cursor that
 * follows a finger, a pointer, or the arrow keys across the series.
 * Switching `view` to `candle` draws open/high/low/close bars over the same
 * geometry and scale; dragging across the plot zooms into that window and
 * re-labels both scales for it.
 *
 * The chart fills the box its host gives it on both axes and re-measures on
 * resize, so the same element serves a phone-width card and a full-width desk
 * layout. It owns no data: hosts pass the series they have, append to it as
 * quotes arrive, and read the cursor and the zoomed window through
 * `onScrubChange` and `onSelectionChange`.
 */
function PriceChart({
  series,
  view = "line",
  baseline,
  tone: toneProp,
  fill = false,
  live = false,
  scrubIndex: scrubIndexProp,
  defaultScrubIndex = null,
  onScrubChange,
  scrubbable = true,
  selectable = true,
  selection: selectionProp,
  defaultSelection = null,
  onSelectionChange,
  formatValue = defaultFormatValue,
  formatTime = defaultFormatTime,
  formatPercent = defaultFormatPercent,
  axes = true,
  formatAxisTime,
  formatAxisValue,
  labels: labelsProp,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: PriceChartProps) {
  const labels = React.useMemo<PriceChartLabels>(
    () => ({ ...priceChartDefaultLabels, ...labelsProp }),
    [labelsProp],
  )
  const plotRef = React.useRef<HTMLDivElement>(null)
  const cursorRef = React.useRef<HTMLDivElement>(null)
  // Read through refs inside the commit callback: the announcement wording
  // and the formatter are presentation, and neither should re-create the
  // commit — or the window listener that calls it — on every render.
  const labelsRef = React.useRef(labels)
  labelsRef.current = labels
  const formatTimeRef = React.useRef(formatTime)
  formatTimeRef.current = formatTime
  // The commit reads the series through a ref as well: a feed that appends a
  // bar per tick would otherwise rebuild the commit, and with it the window
  // listener that ends a drag, on every tick — including mid-drag.
  const seriesRef = React.useRef(series)
  seriesRef.current = series
  // The window on screen right now, for the callbacks that outlive a render.
  const offsetRef = React.useRef(0)
  const gradientId = React.useId()
  const hintId = React.useId()
  const box = useMeasuredBox(plotRef) ?? { width: 0, height: 0 }

  const [uncontrolledSelection, setUncontrolledSelection] =
    React.useState<PriceChartSelection | null>(defaultSelection)
  const selection = priceChartNormalizeSelection(
    selectionProp !== undefined ? selectionProp : uncontrolledSelection,
    series.length,
  )
  // The window being dragged out, in indices of the series as a whole. It
  // lives beside the committed zoom so releasing the drag is what changes
  // what the chart plots.
  const [draft, setDraft] = React.useState<PriceChartSelection | null>(null)
  // A draft is in the plotted window's own coordinates, so it cannot outlive
  // that window: a keyboard band drawn before a re-zoom would otherwise
  // commit against bars it never covered.
  const draftFrameRef = React.useRef<number | null>(null)

  // Everything below plots the visible window, not the whole series, so a
  // zoom needs no second code path: the offset maps a visible bar back to
  // the index the host knows it by.
  const offset = selection?.start ?? 0
  const windowEnd = selection?.end ?? -1
  // A boolean, not the object: `selection` is normalised fresh every render,
  // so anything downstream that only needs "is a zoom open" must depend on
  // this instead, or it defeats its own memo.
  const zoomed = windowEnd >= 0
  offsetRef.current = offset
  // Keyed on the window's own bounds: `selection` is normalised fresh on every
  // render, so an object dependency would defeat this memo (and the geometry
  // and candle memos below it) for the whole time a zoom is active.
  const visible = React.useMemo(
    () => (zoomed ? series.slice(offset, windowEnd + 1) : series),
    [series, offset, windowEnd, zoomed],
  )

  // The window gesture rides the cursor overlay, so it cannot outlive it.
  const canSelect = selectable && scrubbable
  const resolvedView = React.useMemo(
    () => (view === "candle" && !priceChartHasCandles(visible) ? "line" : view),
    [view, visible],
  )
  const geometry = React.useMemo(
    () =>
      priceChartGeometry({
        width: box.width,
        height: box.height,
        series: visible,
        view: resolvedView,
        // A reference far outside a zoomed window would squash it flat, so
        // the baseline only widens the extent of the whole series.
        baseline: zoomed ? undefined : baseline,
      }),
    [box.width, box.height, visible, resolvedView, baseline, zoomed],
  )

  const [uncontrolledScrub, setUncontrolledScrub] = React.useState<
    number | null
  >(defaultScrubIndex)
  const scrubIndex =
    scrubIndexProp !== undefined ? scrubIndexProp : uncontrolledScrub
  const setScrubIndex = React.useCallback(
    (next: number | null) => {
      if (scrubIndexProp === undefined) setUncontrolledScrub(next)
      onScrubChange?.(next)
    },
    [scrubIndexProp, onScrubChange],
  )

  const seriesTone = React.useMemo(
    () => priceChartSeriesTone(visible, zoomed ? undefined : baseline),
    [visible, zoomed, baseline],
  )
  const tone = toneProp ?? seriesTone

  // Indices the host knows bars by are series-wide; `lastVisibleIndex` walks
  // the plotted window, and `offset` maps between the two.
  const lastVisibleIndex = visible.length - 1
  const lastValue =
    lastVisibleIndex >= 0
      ? priceChartBarValue(visible[lastVisibleIndex] as PriceChartBar)
      : null
  const activeIndex =
    scrubIndex !== null &&
    scrubIndex >= offset &&
    scrubIndex <= offset + lastVisibleIndex
      ? scrubIndex
      : null
  const activeBar = activeIndex === null ? null : series[activeIndex]
  const activeValue = activeBar ? priceChartBarValue(activeBar) : null

  const commitSelection = React.useCallback(
    (next: PriceChartSelection | null) => {
      const bars = seriesRef.current
      const normalized = priceChartNormalizeSelection(next, bars.length)
      if (selectionProp === undefined) setUncontrolledSelection(normalized)
      if (!onSelectionChange) return
      if (!normalized) {
        onSelectionChange(null)
        return
      }
      const change = priceChartSelectionChange(bars, normalized)
      onSelectionChange({
        ...normalized,
        startBar: bars[normalized.start] as PriceChartBar,
        endBar: bars[normalized.end] as PriceChartBar,
        changeAmount: change?.amount ?? 0,
        changePercent: change?.percent ?? 0,
      })
    },
    [selectionProp, onSelectionChange],
  )

  // The pointer session lives in a ref as well as state: the first move of a
  // drag can arrive before the pointerdown's state commit, and a session read
  // from state alone would drop it.
  const dragRef = React.useRef<{
    pointerId: number
    /** Visible bar the press landed on — the anchor a window grows from. */
    anchorIndex: number
    originX: number
    /** Whether the press has travelled far enough to become a window. */
    drawing: boolean
    /** The element holding pointer capture, so it can be released. */
    target: HTMLElement
    /**
     * The window the drag has reached, mirrored off state: `pointermove` is a
     * continuous-priority update and `pointerup` a discrete one, so a fast
     * drag can release before React has committed the last move. Reading the
     * draft from state there would commit a window short of where the person
     * let go, or none at all.
     */
    draft: PriceChartSelection | null
    /**
     * The window in force when the press began — both its offset and its bar
     * count — so a host that re-zooms mid-gesture can neither re-base the
     * commit on a different offset nor clamp it to a different length.
     */
    offset: number
    count: number
  } | null>(null)
  // Mirrors the session for the window listener that ends it. A release
  // outside the plot has to finish the drag too, or the band it drew stays
  // on screen with nothing driving it.
  const [dragging, setDragging] = React.useState(false)
  // Where a keyboard-drawn window is anchored, so Shift+Arrow keeps growing
  // from the bar the person started on rather than from the moving edge.
  const keyboardAnchorRef = React.useRef<number | null>(null)

  const indexAtClientX = React.useCallback(
    (clientX: number) => {
      const element = plotRef.current
      if (!element || !visible.length) return -1
      const bounds = element.getBoundingClientRect()
      return priceChartIndexAt(clientX - bounds.left, geometry, resolvedView)
    },
    [geometry, resolvedView, visible.length],
  )

  const scrubToClientX = React.useCallback(
    (clientX: number) => {
      const index = indexAtClientX(clientX)
      if (index >= 0 && offset + index !== scrubIndex) {
        setScrubIndex(offset + index)
      }
      return index
    },
    [indexAtClientX, offset, scrubIndex, setScrubIndex],
  )

  // Ends a gesture without committing anything: the session goes, its capture
  // goes with it, and the marks it left behind go too.
  const abandonDrag = (session: { pointerId: number; target: HTMLElement }) => {
    dragRef.current = null
    setDragging(false)
    release(session.target, session.pointerId)
    draftFrameRef.current = null
    setDraft(null)
    setScrubIndex(null)
  }

  const capture = (element: HTMLElement, pointerId: number) => {
    try {
      element.setPointerCapture(pointerId)
    } catch {
      // Synthetic pointer events in tests carry untracked pointer ids; the
      // gesture still tracks through the element's own move events.
    }
  }

  const release = (element: HTMLElement, pointerId: number) => {
    try {
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId)
      }
    } catch {
      // Nothing to release when the capture never took.
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return
    // One gesture at a time: a second finger landing during a pinch must not
    // take over the session the first one owns.
    if (dragRef.current) return
    const index = scrubToClientX(event.clientX)
    if (index < 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      anchorIndex: index,
      originX: event.clientX,
      drawing: false,
      target: event.currentTarget,
      draft: null,
      offset,
      count: visible.length,
    }
    setDragging(true)
    capture(event.currentTarget, event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    // A mouse scrubs on hover the way a desk trader expects; a finger has to
    // press first, so the page keeps its vertical scroll.
    if (!session && event.pointerType !== "mouse") return
    if (session && session.pointerId !== event.pointerId) return
    const index = scrubToClientX(event.clientX)
    if (!session || !canSelect || index < 0) return
    if (
      !session.drawing &&
      Math.abs(event.clientX - session.originX) < SELECTION_THRESHOLD
    ) {
      return
    }
    // The frame the anchor was taken in has to still be the frame on screen.
    // A feed appending bars is not a new frame — the anchor still names the
    // same bar — but a re-zoom or a shorter series re-bases every index, so
    // the drag is abandoned rather than committed against coordinates it
    // never saw.
    if (session.offset !== offset || visible.length < session.count) {
      abandonDrag(session)
      return
    }
    session.count = visible.length
    session.drawing = true
    const next = { start: session.anchorIndex, end: index }
    session.draft = next
    draftFrameRef.current = offset
    setDraft(next)
  }

  // Pointer capture routes a release back to the plot wherever it happens,
  // so "was it over the plot" has to be measured, never assumed.
  const isOverPlot = React.useCallback((clientX: number, clientY: number) => {
    const bounds = plotRef.current?.getBoundingClientRect()
    return Boolean(
      bounds &&
        clientX >= bounds.left &&
        clientX <= bounds.right &&
        clientY >= bounds.top &&
        clientY <= bounds.bottom,
    )
  }, [])

  const endDrag = React.useCallback(
    (pointerId: number, pointerType: string, overPlot: boolean) => {
      const session = dragRef.current
      if (!session || session.pointerId !== pointerId) return
      dragRef.current = null
      setDragging(false)
      release(session.target, pointerId)
      if (session.offset !== offsetRef.current) {
        draftFrameRef.current = null
        setDraft(null)
        setScrubIndex(null)
        return
      }
      const drawn = priceChartNormalizeSelection(session.draft, session.count)
      draftFrameRef.current = null
      setDraft(null)
      if (drawn && drawn.end > drawn.start) {
        keyboardAnchorRef.current = null
        setScrubIndex(null)
        commitSelection({
          start: session.offset + drawn.start,
          end: session.offset + drawn.end,
        })
        return
      }
      // A press that drew nothing leaves no cursor behind unless the pointer
      // is still hovering the plot — a mouse released off the chart can never
      // send the `pointerleave` that would otherwise clear it.
      if (pointerType !== "mouse" || !overPlot) setScrubIndex(null)
    },
    [commitSelection, setScrubIndex],
  )

  // The pointer can be released anywhere — off the plot, off the window — so
  // the end of a drag is listened for globally rather than on the surface it
  // started on.
  React.useEffect(() => {
    if (!dragging) return
    const finish = (event: PointerEvent) => {
      endDrag(
        event.pointerId,
        event.pointerType,
        isOverPlot(event.clientX, event.clientY),
      )
    }
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    return () => {
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
    }
  }, [dragging, endDrag, isOverPlot])

  const clearSelection = () => {
    keyboardAnchorRef.current = null
    draftFrameRef.current = null
    setDraft(null)
    setScrubIndex(null)
    // Only a committed window is worth reporting as cleared; an abandoned
    // draft was never a selection the host heard about.
    if (selection) commitSelection(null)
    cursorRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!visible.length) return
    const lastVisible = visible.length - 1
    const current =
      activeIndex !== null ? activeIndex - offset : lastVisible
    const bigStep = Math.max(1, Math.round(visible.length / 10))
    const moves: Record<string, number> = {
      ArrowRight: Math.min(lastVisible, current + 1),
      ArrowLeft: Math.max(0, current - 1),
      // A horizontal slider still owes Up and Down: they are the same step,
      // and a person reaching for them should not fall through to the page.
      ArrowUp: Math.min(lastVisible, current + 1),
      ArrowDown: Math.max(0, current - 1),
      PageUp: Math.min(lastVisible, current + bigStep),
      PageDown: Math.max(0, current - bigStep),
      Home: 0,
      End: lastVisible,
    }
    if (event.key === "Escape") {
      // Escape only belongs to the chart while it has something to drop;
      // otherwise it stays available to whatever layer contains the chart.
      const clearable = canSelect && (draft || selection)
      if (!clearable && activeIndex === null) return
      event.preventDefault()
      if (clearable) clearSelection()
      else setScrubIndex(null)
      return
    }
    // A window drawn with Shift+Arrow commits on Enter, the way releasing
    // the pointer commits a dragged one.
    if (event.key === "Enter" && draft) {
      event.preventDefault()
      const drawn = priceChartNormalizeSelection(draft, visible.length)
      draftFrameRef.current = null
      setDraft(null)
      if (drawn && drawn.end > drawn.start) {
        keyboardAnchorRef.current = null
        setScrubIndex(null)
        commitSelection({ start: offset + drawn.start, end: offset + drawn.end })
      }
      return
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    setScrubIndex(offset + next)
    // Shift turns any move into a window, anchored where the walk began —
    // Home, End and the page keys extend it exactly like the arrows rather
    // than throwing away the window in progress.
    if (canSelect && event.shiftKey) {
      const anchor = keyboardAnchorRef.current ?? current
      keyboardAnchorRef.current = anchor
      draftFrameRef.current = offset
      setDraft({ start: anchor, end: next })
      return
    }
    keyboardAnchorRef.current = null
    draftFrameRef.current = null
    setDraft(null)
  }

  const candles = React.useMemo(
    () =>
      resolvedView === "candle" ? priceChartCandles(visible, geometry) : [],
    [resolvedView, visible, geometry],
  )
  const drawable =
    geometry.width > 0 && geometry.height > 0 && visible.length > 0
  // In the candle view every visible bar has a candle — the view falls back
  // to a line otherwise — so a bar's mark is its own index, not a lookup.
  const newestX =
    candles[lastVisibleIndex]?.center ??
    priceChartPointX(lastVisibleIndex, geometry)
  // A zoomed window usually ends before the series does, and a marker that
  // says "live" has to sit on the bar that actually is.
  const showsNewestBar = offset + lastVisibleIndex === series.length - 1
  const localActive = activeIndex === null ? null : activeIndex - offset
  // A transform transition animates from wherever the element was born,
  // which for a freshly mounted cursor is the plot's left edge. The glide is
  // therefore enabled only once the cursor is already on screen.
  const cursorWasVisible = React.useRef(false)
  // A resize re-derives every coordinate in the plot at once. Gliding through
  // that would send the cursor drifting across the chart, off its own line,
  // for the length of the transition — so the glide is only for a cursor that
  // was already on screen in a box that has not just changed size.
  const measuredBoxRef = React.useRef(box)
  const boxChanged =
    measuredBoxRef.current.width !== box.width ||
    measuredBoxRef.current.height !== box.height
  const glideCursor =
    cursorWasVisible.current && activeIndex !== null && !boxChanged
  React.useEffect(() => {
    cursorWasVisible.current = activeIndex !== null
    measuredBoxRef.current = box
  })
  // A live region that exists from first paint (an assistive technology only
  // observes regions it was already watching) and speaks once per committed
  // window, rather than once per bar crossed during the drag.
  const [announcement, setAnnouncement] = React.useState("")
  // Driven by what the chart is actually plotting rather than by the commit:
  // a controlled host that declines to apply a window must not be told the
  // chart zoomed, and a re-commit of the same window changes nothing to say.
  const announcedWindowRef = React.useRef<string | null | undefined>(undefined)
  // A draft only means something in the window it was drawn in.
  React.useEffect(() => {
    if (draftFrameRef.current === null || draftFrameRef.current === offset) {
      return
    }
    setDraft(null)
    draftFrameRef.current = null
  }, [offset])

  React.useEffect(() => {
    const key = zoomed ? `${offset}:${windowEnd}` : null
    if (announcedWindowRef.current === key) return
    const first = announcedWindowRef.current === undefined
    announcedWindowRef.current = key
    // Nothing to announce on first paint, only on a change a person made.
    if (first) return
    const startBar = series[offset]
    const endBar = series[windowEnd]
    setAnnouncement(
      key && startBar && endBar
        ? labelsRef.current.zoomed(
            `${formatTimeRef.current(startBar.time)} – ${formatTimeRef.current(endBar.time)}`,
          )
        : labelsRef.current.cleared,
    )
  }, [zoomed, offset, windowEnd, series])
  const cursorGlideClass = glideCursor
    ? "transition-transform duration-(--nessa-motion-duration-fast) ease-(--nessa-motion-easing-standard)"
    : undefined
  const cursorX =
    localActive === null
      ? 0
      : (candles[localActive]?.center ??
        priceChartPointX(localActive, geometry))
  const draftWindow = drawable
    ? priceChartNormalizeSelection(draft, visible.length)
    : null
  const draftBounds = draftWindow
    ? priceChartSelectionBounds(draftWindow, geometry, resolvedView)
    : null
  const draftChange = draftWindow
    ? priceChartSelectionChange(visible, draftWindow)
    : null
  const draftTone: PriceChartTone = !draftChange
    ? "neutral"
    : draftChange.amount > 0
      ? "gain"
      : draftChange.amount < 0
        ? "loss"
        : "neutral"
  const valueTicks =
    axes && drawable ? priceChartValueTicks(geometry, 4) : []
  const timeTicks =
    axes && drawable
      ? priceChartTimeTicks(visible, geometry, 4, resolvedView)
      : []
  const axisTime = formatAxisTime ?? formatTime
  const axisValue = formatAxisValue ?? formatValue
  // A slider always owes a value, so with no cursor showing it announces the
  // newest bar — the one an arrow press starts from.
  const announcedIndex =
    activeIndex ?? Math.max(0, offset + lastVisibleIndex)
  const announcedBar = series[announcedIndex]
  const announcedValue = announcedBar ? priceChartBarValue(announcedBar) : null
  const barText =
    announcedBar && announcedValue !== null
      ? `${formatTime(announcedBar.time)}, ${formatValue(announcedValue)}`
      : undefined
  const draftFrom = draftWindow ? visible[draftWindow.start] : undefined
  const draftTo = draftWindow ? visible[draftWindow.end] : undefined
  const valueText =
    draftFrom && draftTo
      ? `${labels.selecting(`${formatTime(draftFrom.time)} – ${formatTime(draftTo.time)}`)}${barText ? `, ${barText}` : ""}`
      : barText

  // The summary rides its own width: centred over the band in the middle of
  // the plot, and progressively pulled back as the band nears an edge, so a
  // window drawn at the very end still shows the whole label.
  const summaryX = draftBounds
    ? (draftBounds.left + draftBounds.right) / 2
    : 0
  const summaryShift =
    geometry.width > 0
      ? Math.min(1, Math.max(0, summaryX / geometry.width)) * 100
      : 50

  // One control, two homes: the corner the two scales leave empty, or the
  // plot's own corner when the chart is drawn without scales. It never sits
  // over the bars either way.
  const showClear = Boolean(selection) && canSelect
  const clearControl = (
    <button
      type="button"
      data-slot="price-chart-clear-selection"
      aria-label={labels.clearSelection}
      title={labels.clearSelection}
      onClick={clearSelection}
      className={cn(
        "flex size-7 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground outline-none transition-colors duration-(--nessa-motion-duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_svg]:size-3.5",
        axes ? "absolute top-0 right-0" : "absolute top-1 right-1 border border-border bg-background",
      )}
    >
      <X aria-hidden="true" />
    </button>
  )

  return (
    <div
      data-slot="price-chart"
      data-view={resolvedView}
      data-tone={tone}
      className={cn(
        "relative flex h-full min-h-40 w-full min-w-0 flex-col font-sans text-foreground",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "grid min-h-0 w-full flex-1",
          axes
            ? "grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto]"
            : "grid-cols-1 grid-rows-1",
        )}
      >
      <div
        ref={plotRef}
        role={scrubbable ? undefined : "img"}
        aria-label={scrubbable ? undefined : (ariaLabel ?? labels.chart)}
        className="relative min-h-0 min-w-0"
      >
        {visible.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center nessa-text-3 text-muted-foreground">
            {labels.empty}
          </div>
        ) : null}
        {drawable ? (
          <svg
            aria-hidden="true"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="absolute inset-0 overflow-visible"
          >
            {valueTicks.map((tick) => (
              <line
                key={`grid-${tick.value}`}
                x1={0}
                x2={geometry.width}
                y1={tick.offset}
                y2={tick.offset}
                className="text-border"
                stroke="currentColor"
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            ))}
            {draftBounds && draftBounds.width > 0 ? (
              <g className="text-foreground">
                <rect
                  x={draftBounds.left}
                  y={0}
                  width={draftBounds.width}
                  height={geometry.height}
                  fill="currentColor"
                  fillOpacity={0.07}
                />
                {[draftBounds.left, draftBounds.right].map((edgeX) => (
                  <line
                    key={edgeX}
                    x1={edgeX}
                    x2={edgeX}
                    y1={0}
                    y2={geometry.height}
                    stroke="currentColor"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                ))}
              </g>
            ) : null}
            {resolvedView === "line" ? (
              <g className={toneTextClass(tone)}>
                {fill ? (
                  <>
                    <defs>
                      <linearGradient
                        id={gradientId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="currentColor"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor="currentColor"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d={priceChartAreaPath(visible, geometry)}
                      fill={`url(#${gradientId})`}
                      stroke="none"
                    />
                  </>
                ) : null}
                <path
                  d={priceChartLinePath(visible, geometry)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              candles.map((candle) => (
                <g key={candle.index} className={toneTextClass(candle.tone)}>
                  <line
                    x1={candle.center}
                    x2={candle.center}
                    y1={candle.highY}
                    y2={candle.lowY}
                    stroke="currentColor"
                    strokeWidth={1}
                  />
                  <rect
                    x={candle.x}
                    y={candle.bodyY}
                    width={candle.width}
                    height={candle.bodyHeight}
                    rx={1}
                    fill="currentColor"
                  />
                </g>
              ))
            )}
            {typeof baseline === "number" &&
            baseline >= geometry.min &&
            baseline <= geometry.max ? (
              <line
                x1={0}
                x2={geometry.width}
                y1={priceChartValueY(baseline, geometry)}
                y2={priceChartValueY(baseline, geometry)}
                className="text-muted-foreground"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="2 4"
                strokeOpacity={0.7}
              />
            ) : null}
            {live && showsNewestBar && lastValue !== null ? (
              <g className={toneTextClass(tone)}>
                <circle
                  cx={newestX}
                  cy={priceChartValueY(lastValue, geometry)}
                  r={4}
                  fill="currentColor"
                  fillOpacity={0.35}
                  // An SVG element scales about the view box by default, so
                  // the pulse has to be re-anchored to the dot itself.
                  className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
                />
                <circle
                  data-slot="price-chart-live-marker"
                  cx={newestX}
                  cy={priceChartValueY(lastValue, geometry)}
                  r={3}
                  fill="currentColor"
                />
              </g>
            ) : null}
            {activeIndex !== null ? (
              // Both marks ride a transform rather than their own
              // coordinates, so the cursor glides from bar to bar instead of
              // teleporting. The duration token collapses to zero under
              // reduced motion.
              <g>
                {/* While a window is being dragged out its trailing edge is
                    already the cursor, so a crosshair there would draw a
                    third line through the band. */}
                {draftBounds ? null : (
                  <g
                    className={cursorGlideClass}
                    style={{ transform: `translateX(${cursorX}px)` }}
                  >
                    <line
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={geometry.height}
                      className="text-muted-foreground"
                      stroke="currentColor"
                      strokeWidth={1}
                    />
                  </g>
                )}
                {activeValue !== null && resolvedView === "line" ? (
                  <g
                    className={cursorGlideClass}
                    style={{
                      transform: `translate(${cursorX}px, ${priceChartValueY(activeValue, geometry)}px)`,
                    }}
                  >
                    <circle
                      r={4}
                      className={toneTextClass(tone)}
                      fill="currentColor"
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  </g>
                ) : null}
              </g>
            ) : null}
          </svg>
        ) : null}
        {scrubbable ? (
          <div
            ref={cursorRef}
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel ?? labels.cursor}
            // The reachable range is the plotted window, so a zoom narrows
            // what the cursor advertises as well as what it can walk.
            aria-valuemin={offset}
            aria-valuemax={offset + Math.max(0, lastVisibleIndex)}
            aria-valuenow={announcedIndex}
            aria-valuetext={visible.length === 0 ? labels.empty : valueText}
            aria-disabled={visible.length === 0 || undefined}
            aria-describedby={canSelect ? hintId : undefined}
            aria-keyshortcuts={
              canSelect
                ? "Shift+ArrowLeft Shift+ArrowRight Shift+Home Shift+End Enter Escape"
                : undefined
            }
            data-slot="price-chart-cursor"
            // Horizontal drags scrub, vertical drags still scroll the page.
            className="absolute inset-0 touch-pan-y select-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            // The element's own release is handled directly as well as
            // globally: a press and release inside one frame can finish
            // before the window listener is attached.
            onPointerUp={(event) =>
              endDrag(
                event.pointerId,
                event.pointerType,
                isOverPlot(event.clientX, event.clientY),
              )
            }
            onPointerCancel={(event) =>
              endDrag(event.pointerId, event.pointerType, false)
            }
            onPointerLeave={() => {
              if (dragRef.current === null) setScrubIndex(null)
            }}
            onBlur={() => {
              // A keyboard-drawn band has nothing driving it once focus
              // leaves, exactly like a pointer band after its release.
              keyboardAnchorRef.current = null
              draftFrameRef.current = null
              setDraft(null)
              setScrubIndex(null)
            }}
            onKeyDown={handleKeyDown}
          />
        ) : null}
        {draftBounds && draftBounds.width > 0 && draftWindow ? (
          <div
            data-slot="price-chart-selection-summary"
            aria-hidden="true"
            className="pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-2 py-1 nessa-text-1 whitespace-nowrap text-popover-foreground tabular-nums shadow-sm"
            style={{
              left: `${summaryX}px`,
              transform: `translateX(-${summaryShift}%)`,
            }}
          >
            <span>
              {`${formatTime((visible[draftWindow.start] as PriceChartBar).time)} – ${formatTime((visible[draftWindow.end] as PriceChartBar).time)}`}
            </span>
            {draftChange ? (
              <span className={cn("ml-1.5", toneTextClass(draftTone))}>
                {formatPercent(draftChange.percent)}
              </span>
            ) : null}
          </div>
        ) : null}
        {showClear && !axes ? clearControl : null}
      </div>
        {axes ? (
          <div
            data-slot="price-chart-value-axis"
            aria-hidden="true"
            className="relative min-w-10 pr-1 pl-2 nessa-text-1 text-muted-foreground tabular-nums"
          >
            {/* The labels are positioned, so they contribute no width. This
                copy of the longest one is what sizes the column. */}
            <span className="invisible block whitespace-nowrap">
              {valueTicks.reduce((widest, tick) => {
                const label = axisValue(tick.value)
                return label.length > widest.length ? label : widest
              }, "")}
            </span>
            {valueTicks.map((tick) => (
              <span
                key={tick.value}
                className="absolute left-2 whitespace-nowrap"
                style={{
                  top: `${tick.offset}px`,
                  transform: `translateY(-${tick.ratio * 100}%)`,
                }}
              >
                {axisValue(tick.value)}
              </span>
            ))}
          </div>
        ) : null}
        {axes ? (
          // Deliberately not TimelineHeader: that band lays out `start`/
          // `width` cells for a scale whose units have extent (a day, a
          // week), and pins a label while its cell is in view. These ticks
          // are points on a continuous plot with no cell to pin to and no
          // scroll container to pin against, so they are positioned rather
          // than celled.
          <div
            data-slot="price-chart-time-axis"
            aria-hidden="true"
            className="relative h-7 min-w-0 nessa-text-1 text-muted-foreground tabular-nums"
          >
            {timeTicks.map((tick) => (
              <span
                key={`${tick.value}-${tick.offset}`}
                className="absolute top-1 whitespace-nowrap"
                style={{
                  left: `${tick.offset}px`,
                  transform: `translateX(-${tick.ratio * 100}%)`,
                }}
              >
                {axisTime(tick.value)}
              </span>
            ))}
          </div>
        ) : null}
        {axes ? (
          <div className="relative">{showClear ? clearControl : null}</div>
        ) : null}
      </div>
      {canSelect ? (
        <span id={hintId} className="sr-only">
          {labels.selectionHint}
        </span>
      ) : null}
      {canSelect ? (
        <span role="status" className="sr-only">
          {announcement}
        </span>
      ) : null}
      {children}
    </div>
  )
}

export { PriceChart }
