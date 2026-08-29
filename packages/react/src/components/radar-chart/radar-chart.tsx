"use client"

/** @responsibility Renders a radar (spider) chart — grid rings, spokes, series outlines and axis labels — that fills its host's box, with hover isolation, an axis probe that compares every series on one spoke, and controllable series selection. Geometry comes from radar-chart-geometry. */

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  computeRadarChartLayout,
  radarChartOutlinePath,
  radarChartPoint,
  radarChartRingPath,
  type RadarChartLayout,
  type RadarChartLayoutIssue,
  type RadarChartScale,
} from "./radar-chart-geometry"

/** A spoke of the radar. */
export interface RadarChartAxis {
  /** Unique id series values are keyed by. */
  id: string
  /** Text shown at the outer end of the spoke. Defaults to the id. */
  label?: string
  /**
   * Value that reaches the outer ring on this axis. Omitted, the axis takes
   * its maximum from `scale`.
   */
  max?: number
}

/** One outline drawn across every axis. */
export interface RadarChartSeries {
  /** Unique id. */
  id: string
  /** Name used in labels and accessible names. Defaults to the id. */
  label?: string
  /**
   * Optional CSS color for the outline and its wash. Omitted, series cycle
   * through the chart's `palette`.
   */
  color?: string
  /** Axis id to value. An axis absent here is reported and read as zero. */
  values: Readonly<Record<string, number>>
}

/**
 * The design system's categorical chart ramp, in slot order: blue, orange,
 * aqua, sand, rose, moss, violet, sky. Series take a slot in input order and a
 * slot always means the same entity, so a slice arriving or overtaking
 * another never repaints the ones already on screen.
 *
 * The ramp has two steps per slot, and a component takes the one its mark
 * calls for: a radar outline is a two-pixel line, so it takes the solid step and
 * dilutes that same colour for its area wash. Both are tokens, so each theme carries
 * its own pair — a pale tint on the light surface, a deep one on the dark.
 * The slot ORDER is the colour-vision-deficiency safety mechanism:
 * neighbouring slots are the pairs a reader compares, and this order is the
 * one that clears the separation gates in both themes. Reordering it, or
 * generating a ninth hue, breaks that guarantee.
 */
export const radarChartPalette: readonly string[] = Object.freeze([
  "var(--nessa-chart-series-1-strong)",
  "var(--nessa-chart-series-2-strong)",
  "var(--nessa-chart-series-3-strong)",
  "var(--nessa-chart-series-4-strong)",
  "var(--nessa-chart-series-5-strong)",
  "var(--nessa-chart-series-6-strong)",
  "var(--nessa-chart-series-7-strong)",
  "var(--nessa-chart-series-8-strong)",
])

/** One series' reading on one axis. */
export interface RadarChartReading {
  series: RadarChartSeries
  axis: RadarChartAxis
  value: number
  /** The value as a fraction of the axis maximum, 0..1. */
  ratio: number
}

/** Everything known about an axis when a label or detail is rendered. */
export interface RadarChartAxisContext {
  axis: RadarChartAxis
  /** Zero-based position around the circle. */
  index: number
  /** Value that reaches the outer ring on this axis. */
  max: number
  /** Every series' reading on this axis, largest first. */
  readings: RadarChartReading[]
}

/** Everything known about a series when a detail is rendered. */
export interface RadarChartSeriesContext {
  series: RadarChartSeries
  /** Zero-based position in the input order. */
  index: number
  /** Every reading the series carries, in axis order. */
  readings: RadarChartReading[]
  /** Mean of the series' ratios — the share of the plot its shape covers. */
  coverage: number
}

/** What the pointer is over when hover detail is rendered. */
export type RadarChartHoverContext =
  | { kind: "series"; context: RadarChartSeriesContext }
  | { kind: "axis"; context: RadarChartAxisContext }

/** Emphasis an outline, wash, dot, or label is drawn with. */
type RadarChartEmphasis = "rest" | "active" | "dim"

/** Properties accepted by the RadarChart. */
export interface RadarChartProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  axes: readonly RadarChartAxis[]
  series: readonly RadarChartSeries[]
  /** Grid rings drawn between the centre and the outer edge. */
  rings?: number
  /**
   * Grid style: "polygon" (default) follows the spokes and takes the same
   * `curve` the outlines do, so the grid and the shapes on it share a
   * silhouette; "circle" draws true rings, which stay legible when the axis
   * count is high; "none" leaves the plot bare.
   */
  grid?: "polygon" | "circle" | "none"
  /**
   * How an axis picks its maximum: "shared" (default) puts every axis on one
   * scale, so ring distance is comparable across the chart; "axis"
   * normalises each spoke, so a shape reads as rank rather than magnitude.
   * An axis' own `max` always wins.
   */
  scale?: RadarChartScale
  /** Rotation of the first axis away from straight up, in degrees. */
  startAngle?: number
  /** Axis order around the circle. Clockwise by default. */
  clockwise?: boolean
  /**
   * Outline relaxation, 0 (straight polygon) to 1 (fully rounded blob). The
   * default takes the hard edge off the corners without softening the shape
   * itself; a curve also keeps a three- or four-axis chart from reading as a
   * bare triangle. The spline interpolates, so every value stays exactly on
   * its own spoke at any setting — rounding changes the join, never the
   * reading. Pass 0 for a strict polygon.
   */
  curve?: number
  /** Fills the area inside each outline. On by default. */
  fill?: boolean
  /**
   * When value markers are drawn: "engaged" (default) shows them only on the
   * series being read — the active one, and every series along a probed axis
   * — so a resting chart is just its outlines; "always" marks every reading;
   * "none" never does.
   */
  dots?: "engaged" | "always" | "none"
  /**
   * Width of the label gutter reserved around the plot. Zero hides the axis
   * labels and gives the whole box to the grid.
   */
  labelWidth?: number
  /** Formats a value wherever one is shown. */
  formatValue?: (value: number) => string
  /**
   * Second label line under an axis' name — defaults to the formatted value
   * that reaches the outer ring on that axis. Return null to drop the line.
   */
  renderAxisDetail?: (context: RadarChartAxisContext) => React.ReactNode
  /** Accessible name for a series. Defaults to "label, coverage percent". */
  seriesLabel?: (context: RadarChartSeriesContext) => string
  /**
   * Tints series cycle through in input order; a series' own `color` wins.
   * Pass null for the all-neutral wash.
   */
  palette?: readonly string[] | null
  /** Called as the pointer enters or leaves a series outline. */
  onHoveredSeriesChange?: (
    seriesId: string | null,
    series: RadarChartSeries | null,
  ) => void
  /**
   * Arbitrary content floated beside the pointer while an outline or a spoke
   * is engaged — a stat line, a Card, anything. Return null to skip a
   * particular hover. An axis is engaged by hovering its spoke or its label,
   * or by focusing that label from the keyboard.
   */
  renderHoverDetail?: (hover: RadarChartHoverContext) => React.ReactNode
  /**
   * Called whenever the set of tolerated data problems changes — readings on
   * unknown axes, missing or negative values, duplicate ids — and once after
   * the first layout to establish the initial state. While data streams in,
   * transient issues come and go; once the stream settles, an empty array is
   * the definitive "everything rendered" signal and anything else is a data
   * error worth surfacing.
   */
  onLayoutIssues?: (issues: RadarChartLayoutIssue[]) => void
  /** Controlled selected series ids; empty for no selection. */
  selectedSeriesIds?: readonly string[]
  /** Initial selection when uncontrolled. */
  defaultSelectedSeriesIds?: readonly string[]
  /**
   * Called when the selection changes. A plain click (or Enter or Space)
   * selects just that series; with Command or Ctrl held it toggles the
   * series into the existing selection instead.
   */
  onSelectedSeriesChange?: (
    seriesIds: string[],
    series: RadarChartSeries[],
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

const OUTLINE_CLASSES = cn(
  // The outline takes the series colour as it comes: the ramp is a token per
  // theme, so it is already contrast-correct against whichever surface it
  // lands on. The area behind it is the same colour heavily diluted — radar
  // shapes overlap by nature, and at equal strength the washes stack into one
  // grey blob, so identity lives in the line and the wash only hints at area.
  "pointer-events-none stroke-(--nessa-radar-chart-color) stroke-2",
  "fill-(--nessa-radar-chart-wash)",
  // `d` is a transitionable presentation attribute, so streamed data updates
  // morph the outline instead of snapping it.
  "transition-[opacity,d,stroke-width] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:stroke-[3] data-[emphasis=dim]:opacity-25",
)

// The hit target is the outline's stroke widened well past what is drawn, so
// a series stays easy to grab without its wash swallowing the ones inside it.
// Transparent at rest, it doubles as the focus ring when tabbed to.
const HIT_CLASSES = cn(
  "cursor-pointer fill-none stroke-transparent stroke-[16] outline-none [pointer-events:stroke]",
  "transition-[d] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "focus-visible:stroke-ring",
)

// Open markers: the surface colour inside, the series colour as the ring. A
// filled dot with a background halo reads as a blob at this size and fights
// the outline it sits on; an open one stays light and lets the line through.
const DOT_CLASSES = cn(
  "pointer-events-none fill-background stroke-(--nessa-radar-chart-color) stroke-2",
  "transition-[opacity,cx,cy] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=dim]:opacity-25",
)

/** Radius of a value marker, in pixels. */
const DOT_RADIUS = 3.5

const AXIS_LABEL_CLASSES = cn(
  "absolute flex w-max -translate-y-1/2 cursor-default flex-col",
  "nessa-text-3 leading-tight text-muted-foreground",
  "transition-[color] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
  "data-[emphasis=active]:font-medium data-[emphasis=active]:text-foreground",
)

/**
 * Vertical room a pole label needs: its name over its detail, at the label's
 * own type scale, plus the offset that lifts it clear of the outer ring.
 */
const POLE_LABEL_HEIGHT = 34

/**
 * A radar chart: values plotted along spokes radiating from one centre, one
 * closed outline per series. The chart fills whatever box the host gives it
 * on both axes. Every outline is a keyboard-focusable button: hovering one
 * isolates it and recedes the rest, clicking (or Enter or Space) makes the
 * isolation stick as a selection — with Command or Ctrl held, further series
 * toggle into it — and the selection is host-controllable through
 * `selectedSeriesIds`. Hovering a spoke instead probes that axis, marking
 * every series' reading on it so they can be compared directly; activating
 * its label — by click, Enter, or Space — pins that probe so the comparison
 * survives the pointer leaving. Escape, or a click on the background, clears
 * both the selection and the pinned probe.
 */
function RadarChart({
  axes,
  series,
  rings = 4,
  grid = "polygon",
  scale = "shared",
  startAngle = 0,
  clockwise = true,
  curve = 0.25,
  fill = true,
  dots = "engaged",
  labelWidth = 88,
  formatValue = (value) => String(value),
  renderAxisDetail,
  seriesLabel,
  palette = radarChartPalette,
  onHoveredSeriesChange,
  renderHoverDetail,
  onLayoutIssues,
  selectedSeriesIds,
  defaultSelectedSeriesIds,
  onSelectedSeriesChange,
  className,
  ...props
}: RadarChartProps) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const box = useMeasuredBox(plotRef)

  const [hovered, setHovered] = React.useState<
    { kind: "series"; id: string } | { kind: "axis"; id: string } | null
  >(null)
  // Keyboard focus isolates a series exactly like hover, so Tabbing through
  // the outlines reads the same as sweeping them with the pointer.
  const [focusedSeriesId, setFocusedSeriesId] = React.useState<string | null>(
    null,
  )

  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<
    readonly string[]
  >(defaultSelectedSeriesIds ?? [])
  const selection = selectedSeriesIds ?? uncontrolledSelection
  const selectionSet = React.useMemo(() => new Set(selection), [selection])

  // Duplicate ids keep their FIRST occurrence, matching the geometry's own
  // dedupe — labels, tints, and hover detail must describe the row the
  // geometry was computed from.
  const uniqueAxes = React.useMemo(() => {
    const seen = new Set<string>()
    const result: RadarChartAxis[] = []
    for (const axis of axes) {
      if (seen.has(axis.id)) continue
      seen.add(axis.id)
      result.push(axis)
    }
    return result
  }, [axes])
  const uniqueSeries = React.useMemo(() => {
    const seen = new Set<string>()
    const result: RadarChartSeries[] = []
    for (const entry of series) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      result.push(entry)
    }
    return result
  }, [series])
  const axisById = React.useMemo(
    () => new Map(uniqueAxes.map((axis) => [axis.id, axis])),
    [uniqueAxes],
  )
  const seriesById = React.useMemo(
    () => new Map(uniqueSeries.map((entry) => [entry.id, entry])),
    [uniqueSeries],
  )

  const layout: RadarChartLayout | null = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    return computeRadarChartLayout({
      axes,
      series,
      width: box.width,
      height: box.height,
      rings,
      paddingX: labelWidth > 0 ? labelWidth : 0,
      // A label at a pole is centred on its spoke and needs only its own
      // height, not the gutter width the side labels run into.
      paddingY: labelWidth > 0 ? POLE_LABEL_HEIGHT : 0,
      startAngle,
      clockwise,
      scale,
    })
  }, [box, axes, series, rings, labelWidth, startAngle, clockwise, scale])

  // The browser fires no pointerleave or blur for an element that is removed
  // from the DOM, so a streamed frame that drops the engaged series would
  // leave its id behind — dimming every remaining outline with nothing
  // active, and never telling the host the hover ended. Whatever the layout
  // no longer contains is not engaged.
  const laidOutSeriesIds = React.useMemo(
    () => new Set((layout?.series ?? []).map((entry) => entry.id)),
    [layout],
  )
  const laidOutAxisIds = React.useMemo(
    () => new Set((layout?.axes ?? []).map((axis) => axis.id)),
    [layout],
  )
  const liveHovered =
    hovered === null
      ? null
      : hovered.kind === "series"
        ? laidOutSeriesIds.has(hovered.id)
          ? hovered
          : null
        : laidOutAxisIds.has(hovered.id)
          ? hovered
          : null
  const liveFocusedSeriesId =
    focusedSeriesId !== null && laidOutSeriesIds.has(focusedSeriesId)
      ? focusedSeriesId
      : null
  const highlighted =
    liveHovered ??
    (liveFocusedSeriesId !== null
      ? ({ kind: "series", id: liveFocusedSeriesId } as const)
      : null)

  const onHoveredSeriesChangeRef = React.useRef(onHoveredSeriesChange)
  onHoveredSeriesChangeRef.current = onHoveredSeriesChange
  React.useEffect(() => {
    if (hovered !== null && liveHovered === null) {
      setHovered(null)
      if (hovered.kind === "series") {
        onHoveredSeriesChangeRef.current?.(null, null)
      }
    }
    if (focusedSeriesId !== null && liveFocusedSeriesId === null) {
      setFocusedSeriesId(null)
    }
  }, [hovered, liveHovered, focusedSeriesId, liveFocusedSeriesId])

  // Report tolerated data problems whenever their set changes — including the
  // change back to none, which is the "stream rendered cleanly" signal.
  const onLayoutIssuesRef = React.useRef(onLayoutIssues)
  onLayoutIssuesRef.current = onLayoutIssues
  const issuesKey = layout
    ? layout.issues
        .map(
          (issue) =>
            `${issue.kind}@${issue.axisId ?? ""}@${issue.seriesId ?? ""}:${issue.message}`,
        )
        .join("\n")
    : null
  React.useEffect(() => {
    if (issuesKey === null || !layout) return
    onLayoutIssuesRef.current?.(layout.issues)
    // The layout object changes identity every resize; only a changed issue
    // set should re-notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuesKey])

  // A series takes the slot at its own input position, and an explicit colour
  // occupies that slot rather than skipping it: a counter that advanced only
  // on un-coloured series would re-slot — and repaint — every series after
  // any one of them gained a colour.
  const colorOf = React.useMemo(() => {
    const colors = new Map<string, string>()
    uniqueSeries.forEach((entry, index) => {
      if (entry.color) colors.set(entry.id, entry.color)
      else if (palette && palette.length > 0) {
        colors.set(entry.id, palette[index % palette.length])
      }
    })
    return colors
  }, [uniqueSeries, palette])

  const applySelection = (next: string[]) => {
    if (selectedSeriesIds === undefined) setUncontrolledSelection(next)
    const chosen = new Set(next)
    onSelectedSeriesChange?.(
      next,
      uniqueSeries.filter((entry) => chosen.has(entry.id)),
    )
  }

  /**
   * A plain activation selects just this series (or clears a lone selection
   * of it); an additive one — Command or Ctrl held — toggles the series
   * within the existing selection.
   */
  const activateSeries = (id: string, additive: boolean) => {
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

  // Probing an axis compares every series on that spoke, so it deliberately
  // leaves series emphasis at rest; only a series highlight or a selection
  // isolates one shape from the others.
  // Hovering or focusing a spoke probes it; activating its label pins that
  // probe, so the comparison survives the pointer leaving — the axis
  // analogue of clicking a series to make its isolation stick.
  const [pinnedAxisId, setPinnedAxisId] = React.useState<string | null>(null)
  const livePinnedAxisId =
    pinnedAxisId !== null && laidOutAxisIds.has(pinnedAxisId)
      ? pinnedAxisId
      : null
  const toggleProbe = (axisId: string) =>
    setPinnedAxisId((previous) => (previous === axisId ? null : axisId))
  const probedAxisId =
    liveHovered?.kind === "axis" ? liveHovered.id : livePinnedAxisId
  const emphasisOf = (id: string): RadarChartEmphasis => {
    if (selectionSet.has(id)) return "active"
    if (highlighted?.kind === "series") {
      return highlighted.id === id ? "active" : "dim"
    }
    return selection.length > 0 ? "dim" : "rest"
  }

  // Both contexts are built once per rendered element — a series context for
  // every outline's accessible name, an axis context for every label that
  // asks for detail. Scanning the layout inside them made that quadratic in
  // the series count and cubic in the axis count, so the lookups are indexed
  // once per layout instead.
  const layoutIndex = React.useMemo(() => {
    const axes = new Map((layout?.axes ?? []).map((axis) => [axis.id, axis]))
    const series = new Map(
      (layout?.series ?? []).map((entry) => [entry.id, entry]),
    )
    const pointsBySeries = (layout?.series ?? []).map(
      (entry) =>
        [
          entry.id,
          new Map(entry.points.map((point) => [point.axisId, point])),
        ] as const,
    )
    return { axes, series, pointsBySeries }
  }, [layout])

  const readingsOfSeries = (seriesId: string): RadarChartReading[] => {
    const laid = layoutIndex.series.get(seriesId)
    if (!laid) return []
    return laid.points.map((point) => ({
      series: seriesById.get(seriesId)!,
      axis: axisById.get(point.axisId)!,
      value: point.value,
      ratio: point.ratio,
    }))
  }

  const seriesContext = (seriesId: string): RadarChartSeriesContext => {
    const laid = layoutIndex.series.get(seriesId)!
    return {
      series: seriesById.get(seriesId)!,
      index: laid.index,
      readings: readingsOfSeries(seriesId),
      coverage: laid.coverage,
    }
  }

  const axisContext = (axisId: string): RadarChartAxisContext => {
    const laid = layoutIndex.axes.get(axisId)!
    const readings: RadarChartReading[] = []
    for (const [seriesId, points] of layoutIndex.pointsBySeries) {
      const point = points.get(axisId)
      if (!point) continue
      readings.push({
        series: seriesById.get(seriesId)!,
        axis: axisById.get(axisId)!,
        value: point.value,
        ratio: point.ratio,
      })
    }
    readings.sort((a, b) => b.value - a.value)
    return {
      axis: axisById.get(axisId)!,
      index: laid.index,
      max: laid.max,
      readings,
    }
  }

  const defaultSeriesLabel = (context: RadarChartSeriesContext) =>
    `${context.series.label ?? context.series.id}, ${Math.round(context.coverage * 100)}% of the plot`

  // Geometry-derived strings are stable between interaction renders.
  const outlinePaths = React.useMemo(
    () =>
      layout ? layout.series.map((entry) => radarChartOutlinePath(entry.points, curve)) : [],
    [layout, curve],
  )
  const ringPaths = React.useMemo(() => {
    if (!layout || grid === "none") return []
    const angles = layout.axes.map((axis) => axis.angle)
    return layout.rings.map((radius) =>
      radarChartRingPath(layout.cx, layout.cy, radius, angles, grid, curve),
    )
  }, [layout, grid, curve])

  // The hover-detail card follows the pointer imperatively: routing raw
  // pointer coordinates through React state would re-render every outline per
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

  const trackPointer = (event: React.PointerEvent<Element>) => {
    if (!renderHoverDetail) return
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect) return
    lastPointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    positionHoverDetail()
  }

  const hoverDetail =
    renderHoverDetail && liveHovered && layout
      ? liveHovered.kind === "series"
        ? seriesById.has(liveHovered.id)
          ? renderHoverDetail({
              kind: "series",
              context: seriesContext(liveHovered.id),
            })
          : null
        : axisById.has(liveHovered.id)
          ? renderHoverDetail({
              kind: "axis",
              context: axisContext(liveHovered.id),
            })
          : null
      : null

  return (
    <div
      data-slot="radar-chart"
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
        if (
          event.key === "Escape" &&
          (selection.length > 0 || livePinnedAxisId !== null)
        ) {
          event.stopPropagation()
          setPinnedAxisId(null)
          if (selection.length > 0) applySelection([])
        }
      }}
    >
      <div
        ref={plotRef}
        className="relative min-h-0 min-w-0 flex-1"
        onPointerMove={trackPointer}
      >
        {layout ? (
          <svg
            className="absolute inset-0 size-full overflow-visible"
            width={box!.width}
            height={box!.height}
            onPointerDown={(event) => {
              // A press on empty background clears whatever is engaged — the
              // selection and the pinned probe alike.
              if (event.target !== event.currentTarget) return
              if (selection.length > 0) applySelection([])
              setPinnedAxisId(null)
            }}
          >
            {ringPaths.map((path, index) => (
              <path
                key={`ring-${index}`}
                data-slot="radar-chart-ring"
                aria-hidden="true"
                d={path}
                className="pointer-events-none fill-none stroke-border"
              />
            ))}
            {grid === "none"
              ? null
              : layout.axes.map((axis) => (
                  <line
                    key={`spoke-${axis.id}`}
                    data-slot="radar-chart-spoke"
                    data-axis-id={axis.id}
                    data-emphasis={probedAxisId === axis.id ? "active" : "rest"}
                    aria-hidden="true"
                    x1={layout.cx}
                    y1={layout.cy}
                    x2={axis.x}
                    y2={axis.y}
                    className={cn(
                      "pointer-events-none stroke-border",
                      "transition-[stroke] [transition-duration:var(--nessa-motion-duration-fast)] [transition-timing-function:var(--nessa-motion-easing-standard)] motion-reduce:transition-none",
                      "data-[emphasis=active]:stroke-foreground",
                    )}
                  />
                ))}
            {layout.series.map((entry, renderIndex) => {
              const tint = colorOf.get(entry.id)
              const emphasis = emphasisOf(entry.id)
              return (
                <path
                  key={`outline-${entry.id}`}
                  data-slot="radar-chart-outline"
                  data-series-id={entry.id}
                  data-tinted={tint ? "true" : "false"}
                  data-emphasis={emphasis}
                  aria-hidden="true"
                  d={outlinePaths[renderIndex]}
                  className={OUTLINE_CLASSES}
                  style={
                    {
                      // Both paints derive from the series' own colour, so a
                      // host that overrides `color` gets a matching line and
                      // wash for free; `fill={false}` drops the wash entirely.
                      "--nessa-radar-chart-color":
                        tint ?? "var(--muted-foreground)",
                      "--nessa-radar-chart-wash": fill
                        ? "color-mix(in oklab, var(--nessa-radar-chart-color) 22%, transparent)"
                        : "transparent",
                    } as React.CSSProperties
                  }
                />
              )
            })}
            {dots === "none"
              ? null
              : layout.series.flatMap((entry) => {
                  const tint = colorOf.get(entry.id)
                  const emphasis = emphasisOf(entry.id)
                  return entry.points.flatMap((point) => {
                    // A probed axis marks every series on that spoke so the
                    // readings can be compared at a glance; otherwise only the
                    // series being read carries markers, and a resting chart
                    // stays clean.
                    const marked =
                      emphasis === "active" || probedAxisId === point.axisId
                    if (dots !== "always" && !marked) return []
                    return (
                      <circle
                        key={`dot-${entry.id}-${point.axisId}`}
                        data-slot="radar-chart-dot"
                        data-series-id={entry.id}
                        data-axis-id={point.axisId}
                        data-emphasis={emphasis}
                        aria-hidden="true"
                        cx={point.x}
                        cy={point.y}
                        r={DOT_RADIUS}
                        className={DOT_CLASSES}
                        style={
                          {
                            "--nessa-radar-chart-color":
                              tint ?? "var(--muted-foreground)",
                          } as React.CSSProperties
                        }
                      />
                    )
                  })
                })}
            {/* The axis probe: a transparent stroke over each spoke, wide
                enough to grab, that compares every series on that axis. It is
                the axis' own interaction, so it stays available whether or
                not the grid and the labels are drawn — but it is painted
                BEFORE the series hit strokes. Every vertex sits on a spoke by
                construction, so a probe layered above them would mask exactly
                the points a reader aims at. */}
            {layout.axes.map((axis) => (
              <line
                key={`probe-${axis.id}`}
                data-slot="radar-chart-axis-probe"
                data-axis-id={axis.id}
                aria-hidden="true"
                x1={layout.cx}
                y1={layout.cy}
                x2={axis.x}
                y2={axis.y}
                className="cursor-crosshair stroke-transparent stroke-[14]"
                onPointerEnter={() => setHovered({ kind: "axis", id: axis.id })}
                onPointerLeave={() =>
                  setHovered((previous) =>
                    previous?.kind === "axis" && previous.id === axis.id
                      ? null
                      : previous,
                  )
                }
              />
            ))}
            {/* Interaction sits on its own transparent stroke so the target
                stays generous without the washes stealing each other's
                hovers, and so focus has somewhere visible to land. */}
            {layout.series.map((entry, renderIndex) => {
              const context = seriesContext(entry.id)
              return (
                <path
                  key={`hit-${entry.id}`}
                  data-slot="radar-chart-series"
                  data-series-id={entry.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectionSet.has(entry.id)}
                  aria-label={(seriesLabel ?? defaultSeriesLabel)(context)}
                  d={outlinePaths[renderIndex]}
                  className={HIT_CLASSES}
                  onFocus={() => setFocusedSeriesId(entry.id)}
                  onBlur={() =>
                    setFocusedSeriesId((previous) =>
                      previous === entry.id ? null : previous,
                    )
                  }
                  onPointerEnter={() => {
                    setHovered({ kind: "series", id: entry.id })
                    onHoveredSeriesChange?.(entry.id, seriesById.get(entry.id)!)
                  }}
                  onPointerLeave={() => {
                    setHovered((previous) =>
                      previous?.kind === "series" && previous.id === entry.id
                        ? null
                        : previous,
                    )
                    onHoveredSeriesChange?.(null, null)
                  }}
                  onClick={(event) =>
                    activateSeries(entry.id, event.metaKey || event.ctrlKey)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      activateSeries(entry.id, event.metaKey || event.ctrlKey)
                    }
                  }}
                />
              )
            })}
          </svg>
        ) : null}
        {layout && labelWidth > 0
          ? layout.axes.map((axis) => {
              const input = axisById.get(axis.id)!
              const outer = radarChartPoint(
                layout.cx,
                layout.cy,
                axis.angle,
                layout.radius + 12,
              )
              const detail = renderAxisDetail
                ? renderAxisDetail(axisContext(axis.id))
                : formatValue(axis.max)
              return (
                <div
                  key={`label-${axis.id}`}
                  data-slot="radar-chart-axis-label"
                  data-axis-id={axis.id}
                  data-emphasis={probedAxisId === axis.id ? "active" : "rest"}
                  // The probe is the axis' comparison, and a spoke is not
                  // something a keyboard can point at — so the label is its
                  // keyboard handle: focusing it probes the axis exactly as
                  // hovering the spoke does.
                  tabIndex={0}
                  role="button"
                  // The label's own text is its accessible name — replacing
                  // it with a description would hide the axis' value from a
                  // reader to gain a hint they get from the role anyway.
                  aria-pressed={pinnedAxisId === axis.id}
                  onFocus={() => setHovered({ kind: "axis", id: axis.id })}
                  onBlur={() =>
                    setHovered((previous) =>
                      previous?.kind === "axis" && previous.id === axis.id
                        ? null
                        : previous,
                    )
                  }
                  onClick={() => toggleProbe(axis.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      toggleProbe(axis.id)
                    }
                  }}
                  className={cn(
                    AXIS_LABEL_CLASSES,
                    "outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    axis.anchor === "start" && "items-start text-left",
                    axis.anchor === "end" && "-translate-x-full items-end text-right",
                    axis.anchor === "middle" && "-translate-x-1/2 items-center text-center",
                  )}
                  style={{
                    left: outer.x,
                    top: outer.y,
                    // A side label runs outward into its own gutter, so the
                    // gutter is its budget. A label at a pole is centred over
                    // the plot with the whole width to spread into, and
                    // capping it at the gutter would clip a name that fits.
                    maxWidth:
                      axis.anchor === "middle" ? labelWidth * 2 : labelWidth,
                  }}
                  onPointerEnter={() => setHovered({ kind: "axis", id: axis.id })}
                  onPointerLeave={() =>
                    setHovered((previous) =>
                      previous?.kind === "axis" && previous.id === axis.id
                        ? null
                        : previous,
                    )
                  }
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
        {hoverDetail != null ? (
          <div
            ref={(element) => {
              hoverDetailRef.current = element
              // Position immediately on mount so the card never flashes at a
              // stale spot before the next pointer move.
              if (element) positionHoverDetail()
            }}
            data-slot="radar-chart-hover-detail"
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

export { RadarChart }
