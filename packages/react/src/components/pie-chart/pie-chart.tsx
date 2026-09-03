"use client"

/** @responsibility Renders a pie or donut chart — wedges, labels with leader lines, and a donut centre that reads the total at rest and the engaged slice while one is hovered or selected — filling its host's box, with hover isolation and controllable slice selection. Geometry comes from pie-chart-geometry. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  computePieChartLayout,
  pieChartCentroid,
  pieChartLeaderPath,
  pieChartSlicePath,
  type PieChartLayout,
  type PieChartLayoutIssue,
  type PieChartLayoutSlice,
  type PieChartSort,
} from "./pie-chart-geometry"

/** A wedge of the pie. */
export interface PieChartSlice {
  /** Unique id. */
  id: string
  /** Name shown in labels and accessible names. Defaults to the id. */
  label?: string
  /**
   * Optional CSS color for the wedge. Omitted, slices cycle through the
   * chart's `palette`.
   */
  color?: string
  /** Magnitude of the slice. Non-positive slices are reported and dropped. */
  value: number
}

/**
 * The design system's categorical chart ramp, in slot order: blue, orange,
 * aqua, sand, rose, moss, violet, sky. Slices take a slot in input order and a
 * slot always means the same entity, so a slice arriving or overtaking
 * another never repaints the ones already on screen.
 *
 * The ramp has two steps per slot, and a component takes the one its mark
 * calls for: a wedge is a large filled area, so it takes the pale fill step and lets
 * the gap between wedges do the separating. Both are tokens, so each theme carries
 * its own pair — a pale tint on the light surface, a deep one on the dark.
 * The slot ORDER is the colour-vision-deficiency safety mechanism:
 * neighbouring slots are the pairs a reader compares, and this order is the
 * one that clears the separation gates in both themes. Reordering it, or
 * generating a ninth hue, breaks that guarantee.
 */
export const pieChartPalette: readonly string[] = Object.freeze([
  "var(--nessa-chart-series-1)",
  "var(--nessa-chart-series-2)",
  "var(--nessa-chart-series-3)",
  "var(--nessa-chart-series-4)",
  "var(--nessa-chart-series-5)",
  "var(--nessa-chart-series-6)",
  "var(--nessa-chart-series-7)",
  "var(--nessa-chart-series-8)",
])

/** Everything known about a slice when a label, centre, or detail is rendered. */
export interface PieChartSliceContext {
  /**
   * The input slice. A rolled-up bucket has no input row of its own, so it
   * arrives as a synthetic slice carrying the bucket id and summed value.
   */
  slice: PieChartSlice
  /** Index into the original `slices` input, or -1 for the rolled-up bucket. */
  index: number
  value: number
  /** The slice's share of the total, 0..1. */
  share: number
  /** Sum of every rendered slice's value. */
  total: number
  /** The slices rolled into this bucket, for the grouped slice only. */
  members?: PieChartSlice[]
}

/** What the pointer is over when hover detail is rendered. */
export interface PieChartHoverContext {
  kind: "slice"
  context: PieChartSliceContext
}

/** What the donut centre is asked to render. */
export interface PieChartCenterContext {
  /** Sum of every rendered slice's value. */
  total: number
  /**
   * The slice the chart is currently reading — hovered, focused, or the sole
   * selection — or null at rest.
   */
  engaged: PieChartSliceContext | null
}

/** Emphasis a wedge or label is drawn with. */
type PieChartEmphasis = "rest" | "active" | "dim"

/** Properties accepted by the PieChart. */
export interface PieChartProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  slices: readonly PieChartSlice[]
  /**
   * Hole size as a fraction of the outer radius. 0 (default) draws a solid
   * pie; anything above 0 makes a donut and turns the centre on.
   */
  innerRadius?: number
  /** Gap between adjacent wedges, in degrees. */
  padAngle?: number
  /**
   * Radius of the rounded wedge corners, in pixels. Each wedge clamps it to
   * what it can carry, so a thin slice rounds less rather than deforming.
   * Zero gives the classic hard-edged pie.
   */
  cornerRadius?: number
  /** Where the first slice starts, in degrees clockwise from straight up. */
  startAngle?: number
  /**
   * Where the last slice ends, in degrees clockwise from straight up. A
   * 180-degree sweep makes a gauge.
   */
  endAngle?: number
  /** Slice order around the sweep. Defaults to the input order. */
  sort?: PieChartSort
  /**
   * Slices whose share of the total falls below this fraction are rolled
   * into one trailing bucket, whose members stay reachable through
   * `renderHoverDetail`. 0 (default) keeps every slice, and a lone
   * below-threshold slice is never bucketed — that would only rename it.
   */
  groupThreshold?: number
  /** Id the rolled-up bucket takes. Defaults to "other". */
  groupId?: string
  /** Name the rolled-up bucket is labelled with. Defaults to "Other". */
  groupLabel?: string
  /**
   * Where slice labels sit: "outside" (default) parks them in the gutter on a
   * leader line, "inside" writes them on the wedge, and "none" hides them.
   */
  labels?: "outside" | "inside" | "none"
  /**
   * Width of the label gutter reserved around the plot. Only "outside"
   * labels need it; the other modes give the whole box to the wedges.
   */
  labelWidth?: number
  /**
   * Smallest share that gets a label. Below it a wedge is too thin to carry
   * one legibly, so the reading moves to hover detail. Defaults to 0.03.
   */
  labelMinShare?: number
  /** Formats a value wherever one is shown. */
  formatValue?: (value: number) => string
  /**
   * Second label line under a slice's name — defaults to its share as a
   * percentage. Return null to drop the line.
   */
  renderSliceDetail?: (context: PieChartSliceContext) => React.ReactNode
  /**
   * Content for the middle of a donut. Defaults to the formatted total, or
   * the engaged slice's name and value while one is hovered, focused, or
   * solely selected. Ignored when `innerRadius` is 0.
   */
  renderCenter?: (context: PieChartCenterContext) => React.ReactNode
  /** Accessible name for a slice. Defaults to "label, value, share percent". */
  sliceLabel?: (context: PieChartSliceContext) => string
  /**
   * Tints slices cycle through in laid-out order; a slice's own `color`
   * wins. Pass null for the all-neutral wash.
   */
  palette?: readonly string[] | null
  /** Called as the pointer enters or leaves a wedge. */
  onHoveredSliceChange?: (
    sliceId: string | null,
    context: PieChartSliceContext | null,
  ) => void
  /**
   * Arbitrary content floated beside the pointer while a wedge is hovered —
   * a stat line, a Card, anything. Return null to skip a particular hover.
   */
  renderHoverDetail?: (hover: PieChartHoverContext) => React.ReactNode
  /**
   * Called whenever the set of tolerated data problems changes — dropped
   * non-positive values, duplicate ids, an all-empty data set — and once
   * after the first layout to establish the initial state. While data
   * streams in, transient issues come and go; once the stream settles, an
   * empty array is the definitive "everything rendered" signal and anything
   * else is a data error worth surfacing.
   */
  onLayoutIssues?: (issues: PieChartLayoutIssue[]) => void
  /** Controlled selected slice ids; empty for no selection. */
  selectedSliceIds?: readonly string[]
  /** Initial selection when uncontrolled. */
  defaultSelectedSliceIds?: readonly string[]
  /**
   * Called when the selection changes. A plain click (or Enter or Space)
   * selects just that slice; with Command or Ctrl held it toggles the slice
   * into the existing selection instead.
   */
  onSelectedSlicesChange?: (
    sliceIds: string[],
    slices: PieChartSlice[],
  ) => void
}

function useMeasuredBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(
    null,
  )
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1].contentRect
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

const WEDGE_CLASSES = cn(
  "cursor-pointer fill-[var(--nessa-pie-chart-color,var(--muted-foreground))] outline-none",
  // `d` and `transform` are transitionable presentation attributes, so
  // streamed data updates morph the wedges and a selected slice eases out of
  // the ring instead of jumping.
  "transition-[opacity,d,transform] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "opacity-90 hover:opacity-100",
  "data-[emphasis=active]:opacity-100 data-[emphasis=dim]:opacity-30 data-[emphasis=dim]:hover:opacity-60",
  "focus-visible:stroke-ring focus-visible:stroke-2",
)

const LABEL_CLASSES = cn(
  "pointer-events-none absolute flex -translate-y-1/2 flex-col",
  "nessa-text-3 leading-tight text-muted-foreground",
  "transition-[color,opacity,left,top] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:font-medium data-[emphasis=active]:text-foreground data-[emphasis=dim]:opacity-40",
)

/** How far a selected wedge eases out of the ring, in pixels. */
const SELECTED_OFFSET = 8

/**
 * Vertical room an outside label needs: its name over its detail, at the
 * label's own type scale, plus the leader that lifts it clear of the ring.
 */
const EDGE_LABEL_HEIGHT = 44

/**
 * A pie or donut chart: one wedge per slice, sized to its share of the total,
 * filling whatever box the host gives it. Every wedge is a keyboard-focusable
 * button: hovering one isolates it and recedes the rest, clicking (or Enter
 * or Space) makes the isolation stick as a selection and eases the wedge out
 * of the ring — with Command or Ctrl held, further slices toggle into it —
 * and the selection is host-controllable through `selectedSliceIds`. A donut
 * reads its total in the middle at rest and swaps to the engaged slice while
 * one is hovered, focused, or solely selected. Long tails can be rolled into
 * one bucket with `groupThreshold`, and the sweep can be narrowed to make a
 * gauge. Escape or a background click clears the selection.
 */
function PieChart({
  slices,
  innerRadius = 0,
  padAngle = 1,
  cornerRadius = 4,
  startAngle = 0,
  endAngle = 360,
  sort = "input",
  groupThreshold = 0,
  groupId = "other",
  groupLabel = "Other",
  labels = "outside",
  labelWidth = 96,
  labelMinShare = 0.03,
  formatValue = (value) => String(value),
  renderSliceDetail,
  renderCenter,
  sliceLabel,
  palette = pieChartPalette,
  onHoveredSliceChange,
  renderHoverDetail,
  onLayoutIssues,
  selectedSliceIds,
  defaultSelectedSliceIds,
  onSelectedSlicesChange,
  className,
  ...props
}: PieChartProps) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const box = useMeasuredBox(plotRef)

  const [hoveredId, setRawHoveredId] = React.useState<string | null>(null)
  // Keyboard focus isolates a wedge exactly like hover, so Tabbing through
  // the slices reads the same as sweeping them with the pointer.
  const [focusedId, setFocusedId] = React.useState<string | null>(null)
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<
    readonly string[]
  >(defaultSelectedSliceIds ?? [])
  const selection = selectedSliceIds ?? uncontrolledSelection
  const selectionSet = React.useMemo(() => new Set(selection), [selection])

  // Duplicate ids keep their FIRST occurrence, matching the geometry's own
  // dedupe — labels, tints, and hover detail must describe the row the
  // geometry was computed from.
  const uniqueSlices = React.useMemo(() => {
    const seen = new Set<string>()
    const result: PieChartSlice[] = []
    for (const slice of slices) {
      if (seen.has(slice.id)) continue
      seen.add(slice.id)
      result.push(slice)
    }
    return result
  }, [slices])
  const sliceById = React.useMemo(
    () => new Map(uniqueSlices.map((slice) => [slice.id, slice])),
    [uniqueSlices],
  )

  // Only outside labels need room reserved around the plot; inside labels
  // ride on the wedges themselves, so they give the whole box to the ring.
  const gutter = labels === "outside" ? labelWidth : 0
  const layout: PieChartLayout | null = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    return computePieChartLayout({
      slices,
      width: box.width,
      height: box.height,
      paddingX: gutter,
      // A label at the top or bottom of the ring is centred on its slice and
      // needs only its own height, not the gutter width the side labels use.
      paddingY: gutter > 0 ? EDGE_LABEL_HEIGHT : 0,
      innerRadius,
      padAngle,
      cornerRadius,
      startAngle,
      endAngle,
      sort,
      groupThreshold,
      groupId,
    })
  }, [
    box,
    slices,
    gutter,
    innerRadius,
    padAngle,
    cornerRadius,
    startAngle,
    endAngle,
    sort,
    groupThreshold,
    groupId,
  ])

  // The browser fires no pointerleave or blur for an element that is removed
  // from the DOM, so a streamed frame that drops the engaged wedge would
  // leave its id behind — dimming every remaining wedge with nothing active,
  // and never telling the host the hover ended. Whatever the layout no
  // longer contains is not engaged.
  const laidOutById = React.useMemo(
    () => new Map((layout?.slices ?? []).map((laid) => [laid.id, laid])),
    [layout],
  )
  // Geometry-derived strings are stable between interaction renders.
  const slicePaths = React.useMemo(
    () =>
      layout
        ? layout.slices.map((laid) =>
            pieChartSlicePath(
              laid,
              layout.cx,
              layout.cy,
              layout.outerRadius,
              layout.innerRadius,
              cornerRadius,
            ),
          )
        : [],
    [layout, cornerRadius],
  )

  // Engagement has to be reconciled against what is actually on screen, not
  // merely against the layout: a wedge the pad has collapsed keeps its id and
  // its share but draws no path, so its element unmounts — and an element
  // that unmounts fires no pointerleave or blur.
  const renderedIds = React.useMemo(() => {
    const ids = new Set<string>()
    ;(layout?.slices ?? []).forEach((laid, index) => {
      if (slicePaths[index]) ids.add(laid.id)
    })
    return ids
  }, [layout, slicePaths])
  const liveHoveredId =
    hoveredId !== null && renderedIds.has(hoveredId) ? hoveredId : null
  const liveFocusedId =
    focusedId !== null && renderedIds.has(focusedId) ? focusedId : null
  const highlightedId = liveHoveredId ?? liveFocusedId

  const onHoveredSliceChangeRef = React.useRef(onHoveredSliceChange)
  onHoveredSliceChangeRef.current = onHoveredSliceChange
  React.useEffect(() => {
    if (hoveredId !== null && liveHoveredId === null) {
      setRawHoveredId(null)
      onHoveredSliceChangeRef.current?.(null, null)
    }
    if (focusedId !== null && liveFocusedId === null) setFocusedId(null)
  }, [hoveredId, liveHoveredId, focusedId, liveFocusedId])

  // Report tolerated data problems whenever their set changes — including the
  // change back to none, which is the "stream rendered cleanly" signal.
  const onLayoutIssuesRef = React.useRef(onLayoutIssues)
  onLayoutIssuesRef.current = onLayoutIssues
  const issuesKey = layout
    ? layout.issues
        .map((issue) => `${issue.kind}@${issue.sliceId ?? ""}:${issue.message}`)
        .join("\n")
    : null
  React.useEffect(() => {
    if (issuesKey === null || !layout) return
    onLayoutIssuesRef.current?.(layout.issues)
    // The layout object changes identity every resize; only a changed issue
    // set should re-notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuesKey])

  // Slices take their slot in INPUT order, never laid-out order. Sorting and
  // rolling up reorder the wedges around the circle, and streamed values
  // reorder them mid-flight; assigning by position would repaint every slice
  // that got overtaken, so a colour would mean "third largest right now"
  // instead of naming an entity. The rolled-up bucket is not an entity at
  // all, so it takes the neutral wash rather than a slot of its own.
  const colorOf = React.useMemo(() => {
    const colors = new Map<string, string>()
    if (!palette || palette.length === 0) {
      for (const slice of uniqueSlices) {
        if (slice.color) colors.set(slice.id, slice.color)
      }
      return colors
    }
    uniqueSlices.forEach((slice, index) => {
      colors.set(slice.id, slice.color ?? palette[index % palette.length])
    })
    return colors
  }, [uniqueSlices, palette])

  /**
   * The input row a laid-out wedge describes. A rolled-up bucket has no row
   * of its own, so it gets a synthetic one carrying the bucket's id, label,
   * and summed value.
   */
  const inputFor = (laid: PieChartLayoutSlice): PieChartSlice =>
    sliceById.get(laid.id) ?? {
      id: laid.id,
      label: groupLabel,
      value: laid.value,
    }

  const sliceContext = (laid: PieChartLayoutSlice): PieChartSliceContext => ({
    slice: inputFor(laid),
    index: laid.index,
    value: laid.value,
    share: laid.share,
    total: layout!.total,
    ...(laid.members
      ? {
          members: laid.members.flatMap((id) => {
            const member = sliceById.get(id)
            return member ? [member] : []
          }),
        }
      : {}),
  })

  const applySelection = (next: string[]) => {
    if (selectedSliceIds === undefined) setUncontrolledSelection(next)
    const chosen = new Set(next)
    onSelectedSlicesChange?.(
      next,
      (layout?.slices ?? [])
        .filter((laid) => chosen.has(laid.id))
        .map((laid) => inputFor(laid)),
    )
  }

  /**
   * A plain activation selects just this slice (or clears a lone selection of
   * it); an additive one — Command or Ctrl held — toggles the slice within
   * the existing selection.
   */
  const activateSlice = (id: string, additive: boolean) => {
    if (additive) {
      applySelection(
        selectionSet.has(id)
          ? selection.filter((candidate) => candidate !== id)
          : [...selection, id],
      )
      return
    }
    applySelection(selection.length === 1 && selection[0] === id ? [] : [id])
  }

  const emphasisOf = (id: string): PieChartEmphasis => {
    if (selectionSet.has(id)) return "active"
    if (highlightedId !== null) return highlightedId === id ? "active" : "dim"
    return selection.length > 0 ? "dim" : "rest"
  }

  const defaultSliceLabel = (context: PieChartSliceContext) =>
    `${context.slice.label ?? context.slice.id}, ${formatValue(context.value)}, ${Math.round(context.share * 100)}%`

  // The hover-detail card follows the pointer imperatively: routing raw
  // pointer coordinates through React state would re-render every wedge per
  // mousemove just to move a floating card.
  const hoverDetailRef = React.useRef<HTMLDivElement>(null)
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const positionHoverDetail = React.useCallback(() => {
    const element = hoverDetailRef.current
    const point = lastPointerRef.current
    if (!element || !point || !box) return
    // Flip away from the pointer near the plot's far edges so the card stays
    // inside the chart.
    const flipX = point.x > box.width / 2
    const flipY = point.y > box.height / 2
    element.style.left = `${point.x + (flipX ? -12 : 12)}px`
    element.style.top = `${point.y + (flipY ? -12 : 12)}px`
    element.style.transform = `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`
  }, [box])

  // The centre reads the chart's one engaged slice: whatever is hovered or
  // focused, or a sole selection once the pointer leaves.
  const engagedId =
    highlightedId ?? (selection.length === 1 ? selection[0] : null)
  const engagedLaid =
    layout && engagedId !== null
      ? (laidOutById.get(engagedId) ?? null)
      : null

  const centerContent =
    layout && innerRadius > 0
      ? renderCenter
        ? renderCenter({
            total: layout.total,
            engaged: engagedLaid ? sliceContext(engagedLaid) : null,
          })
        : engagedLaid
          ? [
              <span key="value" className="nessa-text-6 font-medium text-foreground">
                {formatValue(engagedLaid.value)}
              </span>,
              <span key="label" className="nessa-text-2 text-muted-foreground">
                {inputFor(engagedLaid).label ?? engagedLaid.id}
              </span>,
            ]
          : [
              <span key="value" className="nessa-text-6 font-medium text-foreground">
                {formatValue(layout.total)}
              </span>,
              <span key="label" className="nessa-text-2 text-muted-foreground">
                Total
              </span>,
            ]
      : null

  const hoverDetail =
    renderHoverDetail && liveHoveredId !== null && layout
      ? (() => {
          const laid = laidOutById.get(liveHoveredId)
          return laid ? renderHoverDetail({ kind: "slice", context: sliceContext(laid) }) : null
        })()
      : null

  return (
    <div
      data-slot="pie-chart"
      // The host names the chart through aria-label, which a role-less
      // generic element may not carry. "group" permits the name and, unlike
      // "img", leaves the focusable shapes inside reachable.
      role="group"
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 font-sans text-foreground",
        className,
      )}
      {...props}
      // Spread first, then compose: a host that passes its own onKeyDown
      // would otherwise replace this one and silently lose Escape-to-clear.
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === "Escape" && selection.length > 0) {
          event.stopPropagation()
          applySelection([])
        }
      }}
    >
      <div
        ref={plotRef}
        className="relative min-h-0 min-w-0 flex-1"
      >
        {layout ? (
          <svg
            className="absolute inset-0 size-full overflow-visible"
            width={box!.width}
            height={box!.height}
            onPointerDown={(event) => {
              // A press on empty background clears the selection.
              if (event.target === event.currentTarget && selection.length > 0) {
                applySelection([])
              }
            }}
            onPointerMove={
              renderHoverDetail
                ? (event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    lastPointerRef.current = {
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    }
                    positionHoverDetail()
                  }
                : undefined
            }
          >
            {labels === "outside"
              ? layout.slices.map((laid) =>
                  laid.share >= labelMinShare && renderedIds.has(laid.id) ? (
                    <path
                      key={`leader-${laid.id}`}
                      data-slot="pie-chart-leader"
                      data-emphasis={emphasisOf(laid.id)}
                      aria-hidden="true"
                      d={pieChartLeaderPath(
                        laid,
                        layout.cx,
                        layout.cy,
                        layout.outerRadius,
                        10,
                        10,
                      )}
                      className={cn(
                        "pointer-events-none fill-none stroke-border",
                        "transition-[opacity,d] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
                        "data-[emphasis=active]:stroke-foreground data-[emphasis=dim]:opacity-40",
                      )}
                    />
                  ) : null,
                )
              : null}
            {layout.slices.map((laid, renderIndex) => {
              // A wedge the pad has collapsed to nothing draws no path. Left
              // interactive it would be an invisible, unclickable tab stop
              // that dims the whole chart when focused.
              if (!slicePaths[renderIndex]) return null
              const tint = colorOf.get(laid.id)
              const context = sliceContext(laid)
              // A selected wedge eases out of the ring along its own midline,
              // so the selection survives a neighbour being hovered.
              const nudge = selectionSet.has(laid.id)
                ? pieChartCentroid(laid, 0, 0, SELECTED_OFFSET)
                : null
              return (
                <path
                  key={`slice-${laid.id}`}
                  data-slot="pie-chart-slice"
                  data-slice-id={laid.id}
                  data-tinted={tint ? "true" : "false"}
                  data-emphasis={emphasisOf(laid.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectionSet.has(laid.id)}
                  aria-label={(sliceLabel ?? defaultSliceLabel)(context)}
                  d={slicePaths[renderIndex]}
                  transform={
                    nudge ? `translate(${nudge.x} ${nudge.y})` : undefined
                  }
                  className={WEDGE_CLASSES}
                  style={
                    tint
                      ? ({
                          "--nessa-pie-chart-color": tint,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onFocus={() => setFocusedId(laid.id)}
                  onBlur={() =>
                    setFocusedId((previous) =>
                      previous === laid.id ? null : previous,
                    )
                  }
                  onPointerEnter={() => {
                    setRawHoveredId(laid.id)
                    onHoveredSliceChange?.(laid.id, context)
                  }}
                  onPointerLeave={() => {
                    setRawHoveredId((previous) =>
                      previous === laid.id ? null : previous,
                    )
                    onHoveredSliceChange?.(null, null)
                  }}
                  onClick={(event) =>
                    activateSlice(laid.id, event.metaKey || event.ctrlKey)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      activateSlice(laid.id, event.metaKey || event.ctrlKey)
                    }
                  }}
                />
              )
            })}
          </svg>
        ) : null}
        {layout && labels !== "none"
          ? layout.slices.map((laid) => {
              // A wedge the pad has collapsed draws nothing, so a label for
              // it would point at empty space.
              if (laid.share < labelMinShare || !renderedIds.has(laid.id)) {
                return null
              }
              const input = inputFor(laid)
              const context = sliceContext(laid)
              const detail = renderSliceDetail
                ? renderSliceDetail(context)
                : `${Math.round(laid.share * 100)}%`
              const right = Math.sin(laid.centroidAngle) >= 0
              const anchor =
                labels === "inside"
                  ? pieChartCentroid(
                      laid,
                      layout.cx,
                      layout.cy,
                      (layout.innerRadius + layout.outerRadius) / 2,
                    )
                  : pieChartCentroid(
                      laid,
                      layout.cx,
                      layout.cy,
                      layout.outerRadius + 10,
                    )
              return (
                <div
                  key={`label-${laid.id}`}
                  data-slot="pie-chart-label"
                  data-slice-id={laid.id}
                  data-emphasis={emphasisOf(laid.id)}
                  className={cn(
                    LABEL_CLASSES,
                    labels === "inside"
                      // Written on the wedge rather than on the page, so it
                      // takes the ramp's own ink instead of the surface's
                      // foreground — which is near-white on a dark theme and
                      // would sit at 1.9:1 on a pastel fill.
                      ? "-translate-x-1/2 items-center text-center text-(--nessa-chart-label-ink) data-[emphasis=active]:text-(--nessa-chart-label-ink)"
                      : right
                        ? "items-start text-left"
                        : "-translate-x-full items-end text-right",
                  )}
                  style={{
                    left: labels === "inside" ? anchor.x : anchor.x + (right ? 12 : -12),
                    top: anchor.y,
                    maxWidth: labels === "inside" ? undefined : Math.max(gutter, 48),
                  }}
                >
                  <span className="max-w-full truncate">
                    {input.label ?? input.id}
                  </span>
                  {detail == null ? null : (
                    <span className="nessa-text-2 max-w-full truncate">
                      {detail}
                    </span>
                  )}
                </div>
              )
            })
          : null}
        {centerContent != null ? (
          <div
            data-slot="pie-chart-center"
            // The centre swaps on every hover, so it is decoration for the
            // pointer: each wedge already carries its value and share in its
            // own accessible name, and a live region here would narrate the
            // whole ring as the pointer crossed it.
            aria-hidden="true"
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-tight"
            style={{
              left: layout!.centerX,
              top: layout!.centerY,
              maxWidth: layout!.innerRadius * 1.6,
            }}
          >
            {centerContent}
          </div>
        ) : null}
        {hoverDetail != null ? (
          <div
            ref={(element) => {
              hoverDetailRef.current = element
              // Position immediately on mount so the card never flashes at a
              // stale spot before the next pointer move.
              if (element) positionHoverDetail()
            }}
            data-slot="pie-chart-hover-detail"
            className="pointer-events-none absolute w-max"
            style={{ left: -9999, top: 0 }}
          >
            {hoverDetail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { PieChart }
