"use client"

/** @responsibility Renders a small step or line chart sized by its container — a best-so-far step line or a plain polyline over a series of points, with optional point markers, a reference line and an area wash — named by the host. Geometry comes from lib/chart-geometry. */

import * as React from "react"

import {
  bestSoFar,
  linePath,
  linearScale,
  stepChanges,
  stepPath,
  type ChartBetter,
  type ChartPoint,
  type ChartScale,
} from "@/lib/chart-geometry"
import { useComposedRefs } from "@/lib/compose"
import { useMeasuredSize } from "@/lib/size-observer"
import { cn } from "@/lib/utils"

/** Which points a sparkline draws a dot for. */
export type SparklineMarkers = "none" | "records" | "all"

/** Properties accepted by the Sparkline. */
export interface SparklineProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * The series, in data units, in ascending x. With `better` the order does
   * not matter; without it the step line follows the points in the order
   * given. Points with a non-finite coordinate are skipped. A series whose
   * points all share one x — a single reading — is drawn level across the
   * whole box, with its dots at the right-hand end.
   */
  points: readonly ChartPoint[]
  /**
   * Which direction of the value axis is an improvement — given only when
   * the sparkline should derive the best so far itself. With it, the step
   * variant keeps the running maximum for `up` and the running minimum for
   * `down`, and a point that sets a new best is a *record*. Without it
   * (the default), nothing is derived: the step variant draws the points
   * exactly as given, in order — the right choice when the host's series
   * already is the best so far, owned elsewhere, and may fall back when a
   * best is withdrawn — and a *record* is simply a point where the value
   * changes.
   */
  better?: ChartBetter
  /**
   * `step` (default) holds each value flat until the next record, then steps
   * to it — the best so far with `better`, the given values without. `line`
   * joins every point in order.
   */
  variant?: "step" | "line"
  /**
   * `none` (default) draws only the line. `records` adds a dot at every
   * record (see `better`), `all` a dot at every point with the records drawn
   * stronger. Either also marks where the line ends.
   */
  markers?: SparklineMarkers
  /**
   * A value, in data units, to draw as a dashed horizontal reference — a
   * target, a baseline, a previous best. The fitted range always includes
   * it; a pinned `yDomain` does not, and a reference outside it is drawn past
   * the box edge.
   */
  reference?: number
  /** Washes the area under the line. Defaults to true. */
  area?: boolean
  /**
   * A fixed value range, `[min, max]`, for sparklines that must share a scale
   * (a column of them, compared by eye). Omitted, the range fits the points
   * and the reference. Points and a reference outside a pinned range are
   * drawn past the box edge rather than clamped, so a host should pick a range
   * that holds its data.
   */
  yDomain?: readonly [number, number]
  /**
   * The accessible name — what the line shows, in the host's words. Without
   * one (and without `aria-labelledby`), the sparkline is treated as
   * decoration and hidden from assistive technology.
   */
  "aria-label"?: string
}

/** Room kept between the plot and its box, so strokes and dots are never cut. */
const INSET = 4

/** Radii of the dots, in pixels. */
const DOT_RADIUS = { point: 1.5, record: 2.5, end: 3.5 } as const

/**
 * A small chart that fills whatever box the host gives it — set its height
 * with a class, or size its parent. The `step` variant holds each value
 * until the next: given `better`, it derives the best value so far — the
 * running maximum for `up`, the running minimum for `down`, so the line only
 * moves in the direction of improvement — and without it, it steps through
 * the points exactly as given, falls included. The `line` variant joins every
 * point. Optional dots mark the records (or every point), a dashed line
 * marks a reference value, and the line takes the current text colour, so a
 * host tints it with a text utility. A single reading is held level across the box. It is not
 * interactive, and renders nothing until measured.
 */
function Sparkline({
  points,
  better,
  variant = "step",
  markers = "none",
  reference,
  area = true,
  yDomain,
  className,
  ref: forwardedRef,
  ...props
}: SparklineProps) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const composedRef = useComposedRefs(boxRef, forwardedRef)
  const box = useMeasuredSize(boxRef)
  const named =
    props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined

  const shape = React.useMemo(() => {
    if (!box || box.width <= 0 || box.height <= 0) return null
    const plotted = points.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    )
    if (plotted.length === 0) return null
    const xs = plotted.map((point) => point.x)
    const ys = plotted.map((point) => point.y)
    const hasReference = reference !== undefined && Number.isFinite(reference)
    if (hasReference) ys.push(reference)
    const [low, high] =
      yDomain && Number.isFinite(yDomain[0]) && Number.isFinite(yDomain[1])
        ? yDomain
        : [Math.min(...ys), Math.max(...ys)]
    const firstX = Math.min(...xs)
    const lastX = Math.max(...xs)
    // Every point at one x — a single reading — has no run to draw along, so
    // the reading is held level across the box, ending (with its dots) at the
    // right, instead of collapsing to a path with no length.
    const flat = firstX === lastX
    const scale: ChartScale = {
      x: flat
        ? () => box.width - INSET
        : linearScale([firstX, lastX], [INSET, box.width - INSET]),
      y: linearScale([low, high], [box.height - INSET, INSET]),
    }
    // With `better` the best so far is derived here; without it the points
    // are the sequence to draw, and a record is only where it changes.
    const records = better ? bestSoFar(plotted, better) : stepChanges(plotted)
    const recordSet = new Set(records)
    const end =
      variant === "line"
        ? plotted.reduce((latest, point) => (point.x >= latest.x ? point : latest))
        : better
          ? { x: lastX, y: records[records.length - 1]!.y }
          : plotted[plotted.length - 1]!
    const line = flat
      ? `M${INSET},${scale.y(end.y)}H${box.width - INSET}`
      : variant === "step"
        ? stepPath(plotted, scale, { better })
        : linePath(plotted, scale)
    return {
      line,
      area: `${line}V${box.height}H${flat ? INSET : scale.x(firstX)}Z`,
      dots: plotted
        .filter((point) => markers === "all" || recordSet.has(point))
        .map((point) => ({
          cx: scale.x(point.x),
          cy: scale.y(point.y),
          record: recordSet.has(point),
        })),
      end: { cx: scale.x(end.x), cy: scale.y(end.y) },
      reference: hasReference ? scale.y(reference) : null,
    }
  }, [box, points, better, variant, markers, reference, yDomain])

  return (
    <div
      ref={composedRef}
      data-slot="sparkline"
      data-variant={variant}
      data-better={better}
      role={named ? "img" : undefined}
      aria-hidden={named ? undefined : true}
      className={cn(
        "relative h-full min-h-0 w-full min-w-0 text-foreground",
        className,
      )}
      {...props}
    >
      {shape && box ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          width={box.width}
          height={box.height}
        >
          {area ? (
            <path
              data-slot="sparkline-area"
              d={shape.area}
              className="fill-current stroke-none opacity-10"
            />
          ) : null}
          {shape.reference !== null ? (
            <line
              data-slot="sparkline-reference"
              x1={0}
              x2={box.width}
              y1={shape.reference}
              y2={shape.reference}
              strokeDasharray="3 3"
              className="stroke-muted-foreground opacity-60"
            />
          ) : null}
          {markers !== "none"
            ? shape.dots.map((dot, index) => (
                <circle
                  key={index}
                  data-slot="sparkline-marker"
                  data-record={dot.record ? "true" : "false"}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={dot.record ? DOT_RADIUS.record : DOT_RADIUS.point}
                  className={
                    dot.record
                      ? "fill-current"
                      : "fill-muted-foreground opacity-60"
                  }
                />
              ))
            : null}
          <path
            data-slot="sparkline-line"
            d={shape.line}
            fill="none"
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-current"
          />
          {markers !== "none" ? (
            <circle
              data-slot="sparkline-end"
              cx={shape.end.cx}
              cy={shape.end.cy}
              r={DOT_RADIUS.end}
              strokeWidth={2}
              className="fill-current stroke-background"
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}

export { Sparkline }
