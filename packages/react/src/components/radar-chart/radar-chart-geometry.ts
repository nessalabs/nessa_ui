/** @responsibility Pure radar (spider) chart geometry: places axes evenly around a circle, normalises each series value to a radius, stacks the grid rings, and draws polygon or spline outlines. No React, no DOM. */

/** An axis (spoke) of the radar. */
export interface RadarChartAxisInput {
  /** Unique id series values are keyed by. */
  id: string
  /**
   * Value that reaches the outer ring on this axis. Omitted, the axis takes
   * its maximum from the `scale` mode.
   */
  max?: number
}

/** One outline drawn across every axis. */
export interface RadarChartSeriesInput {
  /** Unique id. */
  id: string
  /** Axis id to value. An axis absent here is reported and treated as zero. */
  values: Readonly<Record<string, number>>
}

/**
 * How an axis picks the value that reaches the outer ring: "shared" puts
 * every axis on one scale, so ring distance is comparable across the whole
 * chart; "axis" normalises each axis independently, so a series' shape reads
 * as its rank on each axis rather than its magnitude. An axis' own `max`
 * always wins.
 */
export type RadarChartScale = "shared" | "axis"

/** Inputs the layout is computed from. */
export interface RadarChartLayoutOptions {
  axes: readonly RadarChartAxisInput[]
  series: readonly RadarChartSeriesInput[]
  /** Pixel width of the area the chart fills. */
  width: number
  /** Pixel height of the area the chart fills. */
  height: number
  /** Number of grid rings drawn between the centre and the outer edge. */
  rings: number
  /**
   * Space reserved left and right of the plot for axis labels, in pixels.
   * Side labels run outward, so this is the label's full width.
   */
  paddingX: number
  /**
   * Space reserved above and below the plot, in pixels. Labels at the poles
   * are centred on their spoke and only need their own height, so this is
   * normally much smaller than `paddingX` — reserving the label width on
   * every side would leave most of a wide box empty.
   */
  paddingY: number
  /** Rotation of the first axis away from straight up, in degrees. */
  startAngle?: number
  /** Axis order around the circle. Clockwise by default. */
  clockwise?: boolean
  /** Per-axis normalisation. Defaults to "shared". */
  scale?: RadarChartScale
}

/** A positioned axis. */
export interface RadarChartLayoutAxis {
  id: string
  /** Zero-based position around the circle, in input order. */
  index: number
  /** Angle from straight up, clockwise, in radians. */
  angle: number
  /** Outer end of the spoke. */
  x: number
  y: number
  /** Value that reaches the outer ring on this axis. */
  max: number
  /** Text anchor a label at this angle should use to stay clear of the plot. */
  anchor: "start" | "middle" | "end"
}

/** One series' value on one axis, placed. */
export interface RadarChartLayoutPoint {
  axisId: string
  /** The raw value, after sanitising. */
  value: number
  /** `value / axis.max`, clamped to 0..1. */
  ratio: number
  x: number
  y: number
}

/** A positioned series outline. */
export interface RadarChartLayoutSeries {
  id: string
  /** Index into the original `series` input. */
  index: number
  /** One point per axis, in axis order. */
  points: RadarChartLayoutPoint[]
  /** Mean of the series' ratios — the share of the plot the shape covers. */
  coverage: number
}

/**
 * A data problem the layout tolerated instead of failing on. Transient while
 * data streams in; whatever remains once the stream settles is a real data
 * error the host should surface.
 */
export interface RadarChartLayoutIssue {
  kind:
    | "unknown-axis"
    | "duplicate-axis"
    | "duplicate-series"
    | "missing-value"
    | "invalid-value"
    | "degenerate"
  /** Human-readable summary of what was dropped or repaired. */
  message: string
  /** Offending axis id, for axis-scoped issues. */
  axisId?: string
  /** Offending series id, for series-scoped issues. */
  seriesId?: string
}

/** The computed chart geometry. */
export interface RadarChartLayout {
  cx: number
  cy: number
  /** Distance from the centre to the outer ring. */
  radius: number
  axes: RadarChartLayoutAxis[]
  series: RadarChartLayoutSeries[]
  /** Ring radii from the innermost outward; the last equals `radius`. */
  rings: number[]
  /**
   * Everything the layout dropped or repaired to render this frame — empty
   * when the data was fully consistent.
   */
  issues: RadarChartLayoutIssue[]
}

const TAU = Math.PI * 2

/** Point on the spoke `angle` radians from straight up, `distance` out. */
function polar(
  cx: number,
  cy: number,
  angle: number,
  distance: number,
): { x: number; y: number } {
  return {
    x: cx + Math.sin(angle) * distance,
    y: cy - Math.cos(angle) * distance,
  }
}

/**
 * Which side of the plot a label at this angle sits on. The poles read
 * centred; everything else hangs off the outer edge of its spoke.
 */
function anchorFor(angle: number): "start" | "middle" | "end" {
  const sine = Math.sin(angle)
  if (Math.abs(sine) < 1e-6) return "middle"
  return sine > 0 ? "start" : "end"
}

/**
 * Places axes evenly around a circle sized to fill the box, normalises every
 * series value to a ring distance, and reports whatever it had to repair.
 * Fewer than three axes cannot enclose an area, so the layout renders what it
 * can and records a `degenerate` issue.
 */
export function computeRadarChartLayout(
  options: RadarChartLayoutOptions,
): RadarChartLayout {
  const {
    width,
    height,
    rings,
    paddingX,
    paddingY,
    startAngle = 0,
    clockwise = true,
    scale = "shared",
  } = options
  const issues: RadarChartLayoutIssue[] = []

  // Duplicate ids keep their first occurrence so the geometry and every
  // label, tint, and hover detail describe the same input row.
  const axes: RadarChartAxisInput[] = []
  const seenAxes = new Set<string>()
  for (const axis of options.axes) {
    if (seenAxes.has(axis.id)) {
      issues.push({
        kind: "duplicate-axis",
        axisId: axis.id,
        message: `Axis "${axis.id}" appears more than once; the first occurrence was kept.`,
      })
      continue
    }
    seenAxes.add(axis.id)
    axes.push(axis)
  }

  const series: RadarChartSeriesInput[] = []
  const seenSeries = new Set<string>()
  for (const entry of options.series) {
    if (seenSeries.has(entry.id)) {
      issues.push({
        kind: "duplicate-series",
        seriesId: entry.id,
        message: `Series "${entry.id}" appears more than once; the first occurrence was kept.`,
      })
      continue
    }
    seenSeries.add(entry.id)
    series.push(entry)
  }

  if (axes.length > 0 && axes.length < 3) {
    issues.push({
      kind: "degenerate",
      message: `A radar needs at least three axes to enclose an area; ${axes.length} supplied.`,
    })
  }

  // Sanitise once: a non-finite or negative reading is dropped to zero and
  // reported rather than poisoning the scale every other axis is measured on.
  const readings = new Map<string, Map<string, number>>()
  for (const entry of series) {
    const row = new Map<string, number>()
    for (const [axisId, raw] of Object.entries(entry.values)) {
      if (!seenAxes.has(axisId)) {
        issues.push({
          kind: "unknown-axis",
          axisId,
          seriesId: entry.id,
          message: `Series "${entry.id}" has a value for unknown axis "${axisId}".`,
        })
        continue
      }
      if (!Number.isFinite(raw) || raw < 0) {
        issues.push({
          kind: "invalid-value",
          axisId,
          seriesId: entry.id,
          message: `Series "${entry.id}" has a non-finite or negative value on axis "${axisId}"; it was read as zero.`,
        })
        row.set(axisId, 0)
        continue
      }
      row.set(axisId, raw)
    }
    for (const axis of axes) {
      if (row.has(axis.id)) continue
      issues.push({
        kind: "missing-value",
        axisId: axis.id,
        seriesId: entry.id,
        message: `Series "${entry.id}" has no value on axis "${axis.id}"; it was read as zero.`,
      })
      row.set(axis.id, 0)
    }
    readings.set(entry.id, row)
  }

  // An axis maximum is a reading like any other and is sanitised the same
  // way. Folding a raw one into the shared scale would let a single NaN or
  // Infinity decide the ratio of every other axis — the exact poisoning the
  // pass above prevents for values — and it would do it silently.
  const declaredMax = (axis: RadarChartAxisInput): number | null => {
    if (axis.max === undefined) return null
    if (!Number.isFinite(axis.max) || axis.max <= 0) {
      issues.push({
        kind: "invalid-value",
        axisId: axis.id,
        message: `Axis "${axis.id}" has a non-finite or non-positive maximum; it was ignored.`,
      })
      return null
    }
    return axis.max
  }
  const declaredMaxes = new Map(
    axes.map((axis) => [axis.id, declaredMax(axis)] as const),
  )

  // Spreading a reading set into Math.max blows the call stack somewhere
  // north of a hundred thousand arguments, so the extremes are folded.
  const largest = (values: Iterable<number>): number => {
    let top = 0
    for (const value of values) if (value > top) top = value
    return top
  }

  // A zero maximum would divide every ratio by nothing, so an axis with no
  // positive reading falls back to 1 and simply draws at the centre.
  const sharedMax = Math.max(
    largest(
      (function* () {
        for (const declared of declaredMaxes.values()) {
          if (declared !== null) yield declared
        }
      })(),
    ),
    largest(
      (function* () {
        for (const row of readings.values()) yield* row.values()
      })(),
    ),
  )
  const maxOf = (axis: RadarChartAxisInput): number => {
    const declared = declaredMaxes.get(axis.id) ?? null
    if (declared !== null) return declared
    if (scale === "shared") return sharedMax > 0 ? sharedMax : 1
    const perAxis = largest(
      (function* () {
        for (const row of readings.values()) yield row.get(axis.id) ?? 0
      })(),
    )
    return perAxis > 0 ? perAxis : 1
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.max(
    0,
    Math.min((width - paddingX * 2) / 2, (height - paddingY * 2) / 2),
  )
  const step = axes.length > 0 ? TAU / axes.length : 0
  const direction = clockwise ? 1 : -1
  const origin = (startAngle * Math.PI) / 180

  const layoutAxes: RadarChartLayoutAxis[] = axes.map((axis, index) => {
    const angle = origin + direction * step * index
    const outer = polar(cx, cy, angle, radius)
    return {
      id: axis.id,
      index,
      angle,
      x: outer.x,
      y: outer.y,
      max: maxOf(axis),
      anchor: anchorFor(angle),
    }
  })

  const layoutSeries: RadarChartLayoutSeries[] = series.map((entry, index) => {
    const row = readings.get(entry.id)!
    const points = layoutAxes.map((axis) => {
      const value = row.get(axis.id) ?? 0
      const ratio = Math.min(1, Math.max(0, value / axis.max))
      const point = polar(cx, cy, axis.angle, radius * ratio)
      return { axisId: axis.id, value, ratio, x: point.x, y: point.y }
    })
    const coverage = points.length
      ? points.reduce((sum, point) => sum + point.ratio, 0) / points.length
      : 0
    return { id: entry.id, index, points, coverage }
  })

  const ringCount = Math.max(1, Math.floor(rings))
  const ringRadii = Array.from(
    { length: ringCount },
    (_, index) => (radius * (index + 1)) / ringCount,
  )

  return {
    cx,
    cy,
    radius,
    axes: layoutAxes,
    series: layoutSeries,
    rings: ringRadii,
    issues,
  }
}

/**
 * Closed outline through a series' points. `curve` 0 draws the straight
 * polygon; above 0 it relaxes into a closed Catmull-Rom spline, so a shape
 * with few axes reads as a blob rather than a triangle.
 */
export function radarChartOutlinePath(
  points: readonly { x: number; y: number }[],
  curve: number,
): string {
  if (points.length === 0) return ""
  if (points.length < 3 || curve <= 0) {
    return `${points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join("")}Z`
  }
  const tension = Math.min(1, curve) / 6
  const at = (index: number) =>
    points[((index % points.length) + points.length) % points.length]
  let path = `M${points[0].x},${points[0].y}`
  for (let index = 0; index < points.length; index += 1) {
    const previous = at(index - 1)
    const start = at(index)
    const end = at(index + 1)
    const next = at(index + 2)
    const c1x = start.x + (end.x - previous.x) * tension
    const c1y = start.y + (end.y - previous.y) * tension
    const c2x = end.x - (next.x - start.x) * tension
    const c2y = end.y - (next.y - start.y) * tension
    path += `C${c1x},${c1y} ${c2x},${c2y} ${end.x},${end.y}`
  }
  return `${path}Z`
}

/**
 * One grid ring at `radius`. "polygon" follows the spokes; "circle" draws a
 * true circle, which stays legible when the axis count is high.
 *
 * A polygon ring takes the same `curve` the outlines are drawn with, so the
 * grid and the shapes on it share a silhouette — a rounded outline sitting on
 * a hard-cornered grid reads as a mistake rather than a style. Rounding a
 * ring is also honest: every vertex sits at the same radius, so relaxing the
 * joins bends the ring toward the circle that is the true iso-value contour,
 * never away from it.
 */
export function radarChartRingPath(
  cx: number,
  cy: number,
  radius: number,
  angles: readonly number[],
  shape: "polygon" | "circle",
  curve = 0,
): string {
  if (radius <= 0) return ""
  if (shape === "circle" || angles.length < 3) {
    return `M${cx},${cy - radius}A${radius},${radius} 0 1 1 ${cx - 0.01},${cy - radius}Z`
  }
  return radarChartOutlinePath(
    angles.map((angle) => polar(cx, cy, angle, radius)),
    curve,
  )
}

/** Point on the spoke `angle` radians from straight up, `distance` from the centre. */
export function radarChartPoint(
  cx: number,
  cy: number,
  angle: number,
  distance: number,
): { x: number; y: number } {
  return polar(cx, cy, angle, distance)
}
