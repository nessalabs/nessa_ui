/**
 * @responsibility Pure, DOM-free geometry the small chart primitives share and
 * a host's own charts can build on: round axis ticks over any range, a linear
 * value-to-pixel scale, the best-so-far step line and a plain polyline, the
 * weights a proportion bar sizes its segments by, and the placement that keeps
 * a floating card inside a boundary. Every function is deterministic, so each
 * is unit tested on its own.
 */

/** One observation on a chart, in data units. */
export interface ChartPoint {
  x: number
  y: number
}

/**
 * Which direction of the value axis is an improvement: `up` when a larger
 * value is better (a score), `down` when a smaller one is (a latency, a loss).
 */
export type ChartBetter = "up" | "down"

/** Maps data units to pixels along each axis. */
export interface ChartScale {
  x: (value: number) => number
  y: (value: number) => number
}

/**
 * A linear map from a data interval onto a pixel interval.
 *
 * The range may run backwards — `[height, 0]` is how a value axis puts larger
 * values higher. A domain of zero width has no slope to speak of, so every
 * value maps to the middle of the range rather than to NaN.
 *
 * @param domain - The data interval, `[from, to]`.
 * @param range - The pixel interval the domain lands on, `[from, to]`.
 * @returns The mapping function.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  if (span === 0 || !Number.isFinite(span)) {
    const middle = (r0 + r1) / 2
    return () => middle
  }
  const slope = (r1 - r0) / span
  return (value) => r0 + (value - d0) * slope
}

/**
 * Round tick values for an axis over any range.
 *
 * The step is 1, 2 or 5 times a power of ten — whichever lands the tick count
 * closest to `count` — and the ticks run from the last step at or below `min`
 * to the first step at or above `max`, so the first and last tick bound the
 * data and make a natural axis domain. Nothing about the range is assumed: it
 * may be negative, fractional, or span millions.
 *
 * The inputs are forgiving rather than strict. `min` and `max` are swapped
 * when reversed. Equal bounds are widened around the value (to `[0, 1]` at
 * zero, by a tenth of its magnitude elsewhere) so a flat series still gets an
 * axis. A non-finite bound gives no ticks at all. A range that floating point
 * cannot step through evenly — a window a few units wide around 10^18, or one
 * too wide to measure — gives just its two bounds rather than duplicate or
 * non-finite ticks.
 *
 * @param min - The smallest value the axis must show.
 * @param max - The largest value the axis must show.
 * @param count - Roughly how many ticks to produce; the result may carry a
 *   few more or fewer (up to about √2 times as many), because only round
 *   steps are used. Clamped to 1..{@link MAX_TICK_COUNT}.
 * @returns Ascending, distinct tick values, free of floating-point residue
 *   such as `0.30000000000000004`.
 */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  let low = Math.min(min, max)
  let high = Math.max(min, max)
  if (low === high) {
    if (low === 0) {
      high = 1
    } else {
      const pad = Math.abs(low) / 10
      low -= pad
      high += pad
    }
    // A value so close to zero that a tenth of it underflows cannot be
    // widened: it is its own single tick.
    if (low === high) return [low]
  }
  const bounds = [low, high]
  const intervals = Math.min(
    MAX_TICK_COUNT,
    Math.max(1, Number.isFinite(count) ? Math.round(count) : 1),
  )
  const raw = (high - low) / intervals
  const exponent = Math.floor(Math.log10(raw))
  if (!Number.isFinite(exponent)) return bounds
  const error = raw / Math.pow(10, exponent)
  // The thresholds are the geometric midpoints between neighbouring round
  // steps, so the chosen step is the one nearest the raw one on a log scale.
  const factor =
    error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1
  // Ticks are built as integer multiples and only then scaled, dividing by an
  // integer inverse for fractional steps: 3 / 10 is exactly 0.3, while 3 * 0.1
  // is not.
  const step = exponent >= 0 ? factor * Math.pow(10, exponent) : 0
  const inverse = exponent >= 0 ? 0 : Math.pow(10, -exponent) / factor
  const toIndex = (value: number) => (exponent >= 0 ? value / step : value * inverse)
  const fromIndex = (index: number) => (exponent >= 0 ? index * step : index / inverse)
  const first = Math.floor(toIndex(low))
  const last = Math.ceil(toIndex(high))
  // Past 2^53 an index no longer counts one by one, and a step count far past
  // the request means the step collapsed against the magnitude: either way
  // the ticks would repeat or never end.
  if (
    !Number.isSafeInteger(first) ||
    !Number.isSafeInteger(last) ||
    last - first > intervals * 4 + 2
  ) {
    return bounds
  }
  const ticks: number[] = []
  for (let offset = 0; offset <= last - first; offset += 1) {
    ticks.push(fromIndex(first + offset))
  }
  const distinct = ticks.every(
    (tick, index) =>
      Number.isFinite(tick) && (index === 0 || tick > ticks[index - 1]!),
  )
  return distinct ? ticks : bounds
}

/**
 * The largest tick count {@link niceTicks} honours; a larger request is
 * treated as this. Rounding the step can still yield up to about √2 times the
 * count, plus the two bounding ticks.
 */
export const MAX_TICK_COUNT = 100

/** Points with a finite position on both axes, in ascending x order. */
function plottable(points: readonly ChartPoint[]): ChartPoint[] {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x)
}

/**
 * The points that set a new best, in ascending x order: the first point, then
 * every later point that strictly improves on all before it — larger when
 * `better` is `up`, smaller when it is `down`. A point that only ties the
 * best is not a record, so a flat run draws no step.
 *
 * Points with a non-finite coordinate are ignored, and the input need not be
 * sorted.
 *
 * @param points - The observations, in data units.
 * @param better - Which direction of the value axis is an improvement.
 * @returns The record-setting points, a subset of the input.
 */
export function bestSoFar(
  points: readonly ChartPoint[],
  better: ChartBetter,
): ChartPoint[] {
  const records: ChartPoint[] = []
  for (const point of plottable(points)) {
    const best = records[records.length - 1]
    if (!best || (better === "up" ? point.y > best.y : point.y < best.y)) {
      records.push(point)
    }
  }
  return records
}

/** Options for {@link stepPath}. */
export interface StepPathOptions {
  /** Which direction of the value axis is an improvement. Defaults to `up`. */
  better?: ChartBetter
  /**
   * The x, in data units, the line is carried on to after its last step —
   * typically the newest observation, so the line reaches the present even
   * when the latest points did not improve. Defaults to the largest x among
   * the points.
   */
  until?: number
}

/**
 * An SVG path for the best-so-far line: it holds the running best flat and
 * rises (or, for `down`, falls) only where a point sets a new record, then
 * runs on to `until`. The running maximum is kept when `better` is `up`, the
 * running minimum when it is `down`.
 *
 * The path is step-after — each record holds until the next one — which is
 * the honest reading of a best-so-far: the improvement is not there until the
 * point that made it.
 *
 * @param points - The observations, in data units, in any order.
 * @param scale - The data-to-pixel mapping.
 * @param options - Direction and where the line ends.
 * @returns Path data in pixels, or an empty string when no point is
 *   plottable.
 */
export function stepPath(
  points: readonly ChartPoint[],
  scale: ChartScale,
  options: StepPathOptions = {},
): string {
  const ordered = plottable(points)
  const records = bestSoFar(ordered, options.better ?? "up")
  if (records.length === 0) return ""
  const [first, ...rest] = records
  let path = `M${round(scale.x(first!.x))},${round(scale.y(first!.y))}`
  for (const record of rest) {
    path += `H${round(scale.x(record.x))}V${round(scale.y(record.y))}`
  }
  const end = options.until ?? ordered[ordered.length - 1]!.x
  const last = records[records.length - 1]!
  if (Number.isFinite(end) && end > last.x) path += `H${round(scale.x(end))}`
  return path
}

/**
 * An SVG path joining every plottable point with straight segments, in
 * ascending x order.
 *
 * @param points - The observations, in data units, in any order.
 * @param scale - The data-to-pixel mapping.
 * @returns Path data in pixels, or an empty string when no point is
 *   plottable.
 */
export function linePath(
  points: readonly ChartPoint[],
  scale: ChartScale,
): string {
  return plottable(points)
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${round(scale.x(point.x))},${round(scale.y(point.y))}`,
    )
    .join("")
}

/** Path coordinates to a hundredth of a pixel: finer is invisible and noisy. */
function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * How a proportion bar turns values into segment widths.
 *
 * - `linear` — width is proportional to value: the bar reads as the shares.
 * - `log` — width is proportional to `ln(1 + value / smallest)`, where
 *   `smallest` is the smallest positive value in the bar. See
 *   {@link proportionWeights}.
 */
export type ProportionWeighting = "linear" | "log"

/**
 * The relative width each value takes in a proportion bar, as fractions that
 * sum to 1 over the positive values.
 *
 * `linear` weights are the plain shares. `log` weights are
 * `ln(1 + value / smallest)` normalised, where `smallest` is the smallest
 * positive value present. That rule is chosen for four properties:
 *
 * - it keeps order — a larger value is never drawn narrower;
 * - equal values stay equal;
 * - it is independent of units — multiplying every value by the same factor
 *   changes nothing, so counts, fractions and bytes compress alike;
 * - it compresses by ratio — the smallest segment takes `ln 2` against
 *   `ln(1 + r)` for one `r` times its size, so a segment a thousand times
 *   larger is drawn about ten times wider rather than a thousand.
 *
 * Log widths no longer read as shares. They show which parts exist and
 * roughly how they rank; exact values belong in a legend or summary.
 *
 * A zero, negative or non-finite value weighs 0 under either rule, and a set
 * with no positive value weighs 0 throughout.
 *
 * @param values - One value per segment, in segment order.
 * @param weighting - The rule to apply.
 * @returns One weight per input value, in the same order.
 */
export function proportionWeights(
  values: readonly number[],
  weighting: ProportionWeighting,
): number[] {
  const positive = values.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0,
  )
  const smallest = Math.min(...positive.filter((value) => value > 0))
  const raw =
    weighting === "log" && Number.isFinite(smallest)
      ? positive.map((value) => (value > 0 ? Math.log1p(value / smallest) : 0))
      : positive
  const total = raw.reduce((sum, value) => sum + value, 0)
  return total > 0 ? raw.map((value) => value / total) : raw.map(() => 0)
}

/** A rectangle in viewport pixels. `DOMRect` satisfies it. */
export interface ChartRect {
  left: number
  top: number
  width: number
  height: number
}

/** The side of its anchor a floating card sits on. */
export type ChartTooltipSide = "top" | "right" | "bottom" | "left"

/** What {@link placeChartTooltip} needs to know. */
export interface ChartTooltipPlacementInput {
  /** The point the card describes, in viewport pixels. */
  anchor: { x: number; y: number }
  /** The card's own size, in pixels. */
  size: { width: number; height: number }
  /** The rectangle the card must stay inside, in viewport pixels. */
  boundary: ChartRect
  /** The side of the anchor the card prefers. */
  side: ChartTooltipSide
  /** Gap between the anchor and the card's near edge, in pixels. */
  offset: number
  /** Minimum distance kept from every boundary edge, in pixels. */
  padding: number
}

/** Where {@link placeChartTooltip} puts the card. */
export interface ChartTooltipPlacement {
  /** The card's left edge, in viewport pixels. */
  x: number
  /** The card's top edge, in viewport pixels. */
  y: number
  /** The side it ended up on, after any flip. */
  side: ChartTooltipSide
}

const OPPOSITE: Record<ChartTooltipSide, ChartTooltipSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
}

/**
 * Places a floating card beside a point so that it stays inside a boundary.
 *
 * Along the preferred side's axis the card **flips**: it takes the preferred
 * side when the card fits there, else the opposite side when that fits, else
 * whichever side has more room. Across that axis it is centred on the anchor
 * and then **shifted** just far enough to clear the boundary's edges. Last,
 * both coordinates are clamped inside the padded boundary, so no edge of the
 * card crosses it even when the anchor itself sits at or past an edge.
 *
 * A card larger than the padded boundary cannot fit; it is pinned to the
 * boundary's top or left edge, where its start stays readable.
 *
 * @param input - Anchor, card size, boundary, preferred side, gap, padding.
 * @returns The card's top-left corner and the side it was placed on.
 */
export function placeChartTooltip({
  anchor,
  size,
  boundary,
  side,
  offset,
  padding,
}: ChartTooltipPlacementInput): ChartTooltipPlacement {
  const minX = boundary.left + padding
  const maxX = boundary.left + boundary.width - padding - size.width
  const minY = boundary.top + padding
  const maxY = boundary.top + boundary.height - padding - size.height
  const clamp = (value: number, low: number, high: number) =>
    // `high < low` is the card that cannot fit; the low edge wins.
    Math.max(low, Math.min(value, Math.max(low, high)))

  /** Where the card's near edge lands on a side, and how much room that side has. */
  const along = (candidate: ChartTooltipSide) => {
    switch (candidate) {
      case "right":
        return {
          position: anchor.x + offset,
          fits: anchor.x + offset <= maxX,
          room: boundary.left + boundary.width - padding - anchor.x - offset,
        }
      case "left":
        return {
          position: anchor.x - offset - size.width,
          fits: anchor.x - offset - size.width >= minX,
          room: anchor.x - offset - minX,
        }
      case "bottom":
        return {
          position: anchor.y + offset,
          fits: anchor.y + offset <= maxY,
          room: boundary.top + boundary.height - padding - anchor.y - offset,
        }
      case "top":
        return {
          position: anchor.y - offset - size.height,
          fits: anchor.y - offset - size.height >= minY,
          room: anchor.y - offset - minY,
        }
    }
  }

  const preferred = along(side)
  const opposite = along(OPPOSITE[side])
  const resolved = preferred.fits
    ? side
    : opposite.fits
      ? OPPOSITE[side]
      : preferred.room >= opposite.room
        ? side
        : OPPOSITE[side]
  const main = resolved === side ? preferred.position : opposite.position

  if (resolved === "left" || resolved === "right") {
    return {
      x: clamp(main, minX, maxX),
      y: clamp(anchor.y - size.height / 2, minY, maxY),
      side: resolved,
    }
  }
  return {
    x: clamp(anchor.x - size.width / 2, minX, maxX),
    y: clamp(main, minY, maxY),
    side: resolved,
  }
}

/**
 * The part of one rectangle that lies inside another — how a boundary is cut
 * down to what is actually visible. Rectangles that do not overlap give an
 * empty rectangle at the first one's corner.
 *
 * @param a - The first rectangle.
 * @param b - The second rectangle.
 * @returns Their intersection.
 */
export function intersectChartRects(a: ChartRect, b: ChartRect): ChartRect {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.width, b.left + b.width)
  const bottom = Math.min(a.top + a.height, b.top + b.height)
  if (right < left || bottom < top) {
    return { left: a.left, top: a.top, width: 0, height: 0 }
  }
  return { left, top, width: right - left, height: bottom - top }
}
