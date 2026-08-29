"use client"

import * as React from "react"
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
  /** Accessible name of the plot when the host supplies none. */
  chart: string
  /** Shown and announced in place of the plot when the series is empty. */
  empty: string
  /** Names the scrub cursor for assistive technology. */
  cursor: string
  /** Names the control that returns a zoomed chart to the full series. */
  clearSelection: string
}

/** The out-of-the-box English strings. */
export const priceChartDefaultLabels: PriceChartLabels = Object.freeze({
  chart: "Price chart",
  empty: "No price data",
  cursor: "Price cursor",
  clearSelection: "Clear selection",
})

const toneTextClass: Record<PriceChartTone, string> = {
  gain: "text-(--nessa-market-gain)",
  loss: "text-(--nessa-market-loss)",
  neutral: "text-muted-foreground",
}

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

export interface PriceChartProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** The observations to plot, oldest first. */
  series: readonly PriceChartBar[]
  /**
   * Whether to draw a continuous price line or one candle per bar. A candle
   * view falls back to the line when the series carries no open/high/low/
   * close set, so a host may offer the toggle without gating it on the data.
   */
  view?: PriceChartView
  /**
   * The reference price drawn as a dotted rule — a previous close, a cost
   * basis, an alert level. It also becomes the comparison for the automatic
   * tone, and is always kept inside the plotted range.
   */
  baseline?: number
  /**
   * Forces the market color instead of deriving it from the series. Leave it
   * unset for the usual behavior: green while the last price is above the
   * baseline (or the first price), red below.
   */
  tone?: PriceChartTone
  /** Fades a tone-colored wash from the line down to the bottom edge. */
  fill?: boolean
  /** Marks the newest bar with a pulsing dot for a streaming quote. */
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
   * Turns off pointer and keyboard scrubbing. The plot then exposes itself
   * as a single labelled image instead of a cursor.
   */
  scrubbable?: boolean
  /**
   * Whether dragging across the plot selects a window to zoom into. The
   * drag draws a shaded band with a running summary; releasing it re-plots
   * the chart on that window alone, and the clear control or Escape returns
   * to the full series.
   */
  selectable?: boolean
  /**
   * Controlled zoom window, as inclusive indices into `series`. `null` plots
   * the whole series.
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
   * along the bottom. Both re-read the plotted window, so zooming re-labels
   * them. Turn them off for sparkline-sized charts.
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
  const gradientId = React.useId()
  const [box, setBox] = React.useState({ width: 0, height: 0 })

  // The host owns the box; the plot only reads it. Sub-pixel churn is
  // ignored so a scrollbar appearing next to the chart cannot oscillate the
  // measurement.
  React.useEffect(() => {
    const element = plotRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const next = {
        width: element.clientWidth,
        height: element.clientHeight,
      }
      setBox((previous) =>
        Math.abs(previous.width - next.width) > 1 ||
        Math.abs(previous.height - next.height) > 1
          ? next
          : previous,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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

  // Everything below plots the visible window, not the whole series, so a
  // zoom needs no second code path: the offset maps a visible bar back to
  // the index the host knows it by.
  const offset = selection?.start ?? 0
  const visible = React.useMemo(
    () =>
      selection ? series.slice(selection.start, selection.end + 1) : series,
    [series, selection],
  )

  const resolvedView =
    view === "candle" && !priceChartHasCandles(visible) ? "line" : view
  const geometry = React.useMemo(
    () =>
      priceChartGeometry({
        width: box.width,
        height: box.height,
        series: visible,
        view: resolvedView,
        // A reference far outside a zoomed window would squash it flat, so
        // the baseline only widens the extent of the whole series.
        baseline: selection ? undefined : baseline,
      }),
    [box.width, box.height, visible, resolvedView, baseline, selection],
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
    () => priceChartSeriesTone(visible, selection ? undefined : baseline),
    [visible, selection, baseline],
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
      const normalized = priceChartNormalizeSelection(next, series.length)
      if (selectionProp === undefined) setUncontrolledSelection(normalized)
      if (!onSelectionChange) return
      if (!normalized) {
        onSelectionChange(null)
        return
      }
      const change = priceChartSelectionChange(series, normalized)
      onSelectionChange({
        ...normalized,
        startBar: series[normalized.start] as PriceChartBar,
        endBar: series[normalized.end] as PriceChartBar,
        changeAmount: change?.amount ?? 0,
        changePercent: change?.percent ?? 0,
      })
    },
    [series, selectionProp, onSelectionChange],
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
    const index = scrubToClientX(event.clientX)
    if (index < 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      anchorIndex: index,
      originX: event.clientX,
      drawing: false,
      target: event.currentTarget,
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
    if (!session || !selectable || index < 0) return
    if (
      !session.drawing &&
      Math.abs(event.clientX - session.originX) < SELECTION_THRESHOLD
    ) {
      return
    }
    session.drawing = true
    setDraft({ start: session.anchorIndex, end: index })
  }

  const endDrag = React.useCallback(
    (pointerId: number, pointerType: string) => {
      const session = dragRef.current
      if (!session || session.pointerId !== pointerId) return
      dragRef.current = null
      setDragging(false)
      release(session.target, pointerId)
      const drawn = priceChartNormalizeSelection(draft, visible.length)
      setDraft(null)
      if (session.drawing && drawn && drawn.end > drawn.start) {
        keyboardAnchorRef.current = null
        setScrubIndex(null)
        commitSelection({ start: offset + drawn.start, end: offset + drawn.end })
        return
      }
      if (pointerType !== "mouse") setScrubIndex(null)
    },
    [draft, visible.length, offset, commitSelection, setScrubIndex],
  )

  // The pointer can be released anywhere — off the plot, off the window — so
  // the end of a drag is listened for globally rather than on the surface it
  // started on.
  React.useEffect(() => {
    if (!dragging) return
    const finish = (event: PointerEvent) => {
      endDrag(event.pointerId, event.pointerType)
    }
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    return () => {
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
    }
  }, [dragging, endDrag])

  const clearSelection = () => {
    keyboardAnchorRef.current = null
    setDraft(null)
    setScrubIndex(null)
    commitSelection(null)
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
      PageUp: Math.min(lastVisible, current + bigStep),
      PageDown: Math.max(0, current - bigStep),
      Home: 0,
      End: lastVisible,
    }
    if (event.key === "Escape") {
      event.preventDefault()
      if (draft || selection) clearSelection()
      else setScrubIndex(null)
      return
    }
    // A window drawn with Shift+Arrow commits on Enter, the way releasing
    // the pointer commits a dragged one.
    if (event.key === "Enter" && draft) {
      event.preventDefault()
      const drawn = priceChartNormalizeSelection(draft, visible.length)
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
    if (
      selectable &&
      event.shiftKey &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      const anchor = keyboardAnchorRef.current ?? current
      keyboardAnchorRef.current = anchor
      setDraft({ start: anchor, end: next })
      return
    }
    keyboardAnchorRef.current = null
    setDraft(null)
  }

  const candles = React.useMemo(
    () =>
      resolvedView === "candle" ? priceChartCandles(visible, geometry) : [],
    [resolvedView, visible, geometry],
  )
  const drawable =
    geometry.width > 0 && geometry.height > 0 && visible.length > 0
  const localActive = activeIndex === null ? null : activeIndex - offset
  // A transform transition animates from wherever the element was born,
  // which for a freshly mounted cursor is the plot's left edge. The glide is
  // therefore enabled only once the cursor is already on screen.
  const cursorWasVisible = React.useRef(false)
  const glideCursor = cursorWasVisible.current && activeIndex !== null
  React.useEffect(() => {
    cursorWasVisible.current = activeIndex !== null
  })
  const cursorTransition = glideCursor
    ? "transform var(--nessa-motion-duration-fast) var(--nessa-motion-easing-standard)"
    : "none"
  const cursorX =
    localActive === null
      ? 0
      : resolvedView === "candle"
        ? ((candles.find((candle) => candle.index === localActive)?.center ??
            priceChartPointX(localActive, geometry)))
        : priceChartPointX(localActive, geometry)
  // A slider always owes a value, so with no cursor showing it announces the
  // newest bar — the one an arrow press starts from.
  const announcedIndex =
    activeIndex ?? Math.max(0, offset + lastVisibleIndex)
  const announcedBar = series[announcedIndex]
  const announcedValue = announcedBar ? priceChartBarValue(announcedBar) : null
  const valueText =
    announcedBar && announcedValue !== null
      ? `${formatTime(announcedBar.time)}, ${formatValue(announcedValue)}`
      : undefined

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
  const clearControl = (
    <button
      type="button"
      data-slot="price-chart-clear-selection"
      aria-label={labels.clearSelection}
      title={labels.clearSelection}
      onClick={clearSelection}
      className={cn(
        "flex size-6 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_svg]:size-3.5",
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
              <g className={toneTextClass[tone]}>
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
                <g key={candle.index} className={toneTextClass[candle.tone]}>
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
            {live && resolvedView === "line" && lastValue !== null ? (
              <g className={toneTextClass[tone]}>
                <circle
                  cx={priceChartPointX(lastVisibleIndex, geometry)}
                  cy={priceChartValueY(lastValue, geometry)}
                  r={4}
                  fill="currentColor"
                  fillOpacity={0.35}
                  // An SVG element scales about the view box by default, so
                  // the pulse has to be re-anchored to the dot itself.
                  className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
                />
                <circle
                  cx={priceChartPointX(lastVisibleIndex, geometry)}
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
                    style={{
                      transform: `translateX(${cursorX}px)`,
                      transition: cursorTransition,
                    }}
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
                    style={{
                      transform: `translate(${cursorX}px, ${priceChartValueY(activeValue, geometry)}px)`,
                      transition: cursorTransition,
                    }}
                  >
                    <circle
                      r={4}
                      className={toneTextClass[tone]}
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
            role="slider"
            tabIndex={0}
            aria-label={ariaLabel ?? labels.cursor}
            // The reachable range is the plotted window, so a zoom narrows
            // what the cursor advertises as well as what it can walk.
            aria-valuemin={offset}
            aria-valuemax={offset + Math.max(0, lastVisibleIndex)}
            aria-valuenow={announcedIndex}
            aria-valuetext={valueText}
            aria-disabled={visible.length === 0 || undefined}
            data-slot="price-chart-cursor"
            // Horizontal drags scrub, vertical drags still scroll the page.
            className="absolute inset-0 touch-pan-y outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            // The element's own release is handled directly as well as
            // globally: a press and release inside one frame can finish
            // before the window listener is attached.
            onPointerUp={(event) => endDrag(event.pointerId, event.pointerType)}
            onPointerCancel={(event) =>
              endDrag(event.pointerId, event.pointerType)
            }
            onPointerLeave={() => {
              if (dragRef.current === null) setScrubIndex(null)
            }}
            onBlur={() => setScrubIndex(null)}
            onKeyDown={handleKeyDown}
          />
        ) : null}
        {draftBounds && draftBounds.width > 0 && draftWindow ? (
          <div
            data-slot="price-chart-selection-summary"
            role="status"
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
              <span className={cn("ml-1.5", toneTextClass[draftTone])}>
                {formatPercent(draftChange.percent)}
              </span>
            ) : null}
          </div>
        ) : null}
        {selection && !axes ? clearControl : null}
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
          <div
            data-slot="price-chart-time-axis"
            aria-hidden="true"
            className="relative h-6 min-w-0 nessa-text-1 text-muted-foreground tabular-nums"
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
          <div className="relative">{selection ? clearControl : null}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export { PriceChart }
