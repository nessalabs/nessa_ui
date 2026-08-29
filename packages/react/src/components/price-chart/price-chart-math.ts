/**
 * @responsibility Pure plotting geometry for PriceChart: the value extent, the
 * index-to-pixel mapping, and the path, candle and tick layouts derived from
 * them. Every function here is deterministic and DOM-free, so the drawing math
 * is unit tested on its own. Most of it is the component's private render
 * sequence; the kit re-exports only the handful a consumer reads a series
 * with — bar values, direction, and a window's change.
 */

/**
 * One observation on a price series. `time` is an epoch milliseconds stamp
 * used for labels only — bars are placed by their index so a market's gaps
 * (nights, weekends, halts) never stretch the plot. Line views read
 * `value`, falling back to `close`; candle views need the full open/high/
 * low/close set and skip any bar that lacks it.
 */
export interface PriceChartBar {
  /** Epoch milliseconds for the observation, used for crosshair labels. */
  time: number
  /** The traded or closing price a line view plots. Defaults to `close`. */
  value?: number
  /** Opening price of the interval. */
  open?: number
  /** Highest price of the interval. */
  high?: number
  /** Lowest price of the interval. */
  low?: number
  /** Closing price of the interval. */
  close?: number
}

/** How a series is drawn: a continuous price line, or one candle per bar. */
export type PriceChartView = "line" | "candle"

/** The direction a price moved, which selects the market color. */
export type PriceChartTone = "gain" | "loss" | "neutral"

/**
 * The plotted price of a bar in a line view: its `value`, then `close`, then
 * `open`. Returns `null` for a bar that carries no price at all, which the
 * line path treats as a break in the series.
 */
export function priceChartBarValue(bar: PriceChartBar): number | null {
  // Each candidate is tested rather than coalesced: a NaN price is as absent
  // as a missing one and must fall through to the next. Written as branches
  // rather than a loop over a literal array — this runs once per bar per
  // pass, several passes per render.
  if (typeof bar.value === "number" && Number.isFinite(bar.value)) {
    return bar.value
  }
  if (typeof bar.close === "number" && Number.isFinite(bar.close)) {
    return bar.close
  }
  if (typeof bar.open === "number" && Number.isFinite(bar.open)) {
    return bar.open
  }
  return null
}

/** Whether a bar carries the full open/high/low/close set a candle needs. */
export function priceChartIsCandle(bar: PriceChartBar): boolean {
  return [bar.open, bar.high, bar.low, bar.close].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  )
}

/**
 * Whether a series can be drawn as candles at all. Hosts use it to decide
 * whether to offer the candle toggle; PriceChart falls back to the line view
 * when it is false.
 */
export function priceChartHasCandles(
  series: readonly PriceChartBar[],
): boolean {
  return series.length > 0 && series.every(priceChartIsCandle)
}

/** The lowest and highest prices a view has to fit on screen. */
export interface PriceChartExtent {
  min: number
  max: number
}

/**
 * The value range a view must cover. Line views measure plotted prices;
 * candle views measure wick extremes. A `baseline` is always included so the
 * reference line stays inside the plot, and a flat series is widened by one
 * percent so it draws through the middle instead of collapsing onto an edge.
 */
export function priceChartExtent(
  series: readonly PriceChartBar[],
  view: PriceChartView = "line",
  baseline?: number,
): PriceChartExtent {
  const values: number[] = []
  for (const bar of series) {
    if (view === "candle" && priceChartIsCandle(bar)) {
      values.push(bar.low as number, bar.high as number)
      continue
    }
    const value = priceChartBarValue(bar)
    if (value !== null) values.push(value)
  }
  if (typeof baseline === "number" && Number.isFinite(baseline)) {
    values.push(baseline)
  }
  if (!values.length) return { min: 0, max: 1 }
  // Reduced rather than spread: a tick-level series carries more values than
  // an argument list can hold, and Math.min(...values) would throw there.
  let min = values[0] as number
  let max = values[0] as number
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (min === max) {
    const padding = Math.abs(min) * 0.01 || 0.5
    return { min: min - padding, max: max + padding }
  }
  return { min, max }
}

/**
 * The resolved pixel mapping for one render pass: the measured box, the bar
 * count, the value extent, and the vertical inset that keeps strokes, the
 * live marker, and candle wicks inside the box.
 */
export interface PriceChartGeometry {
  width: number
  height: number
  count: number
  min: number
  max: number
  inset: number
}

/**
 * Builds the pixel mapping for a measured box. `inset` is the breathing room
 * reserved at the top and bottom of the plot in pixels; it is clamped so a
 * short box still leaves a drawable band.
 */
export function priceChartGeometry(options: {
  width: number
  height: number
  series: readonly PriceChartBar[]
  view?: PriceChartView
  baseline?: number
  inset?: number
}): PriceChartGeometry {
  const { width, height, series, view = "line", baseline, inset = 6 } = options
  const extent = priceChartExtent(series, view, baseline)
  return {
    width: Math.max(0, width),
    height: Math.max(0, height),
    count: series.length,
    min: extent.min,
    max: extent.max,
    inset: Math.max(0, Math.min(inset, height / 4)),
  }
}

/**
 * The horizontal center of the bar at `index`. Bars are evenly spaced across
 * the full width; a lone bar sits in the middle of the box.
 */
export function priceChartPointX(
  index: number,
  geometry: PriceChartGeometry,
): number {
  if (geometry.count <= 1) return geometry.width / 2
  const step = geometry.width / (geometry.count - 1)
  return index * step
}

/** The vertical position of a price inside the inset plot band. */
export function priceChartValueY(
  value: number,
  geometry: PriceChartGeometry,
): number {
  const span = geometry.max - geometry.min
  const band = Math.max(0, geometry.height - geometry.inset * 2)
  if (span <= 0) return geometry.inset + band / 2
  const ratio = (value - geometry.min) / span
  return geometry.inset + (1 - ratio) * band
}

/**
 * The subpaths a series draws: one run of `M`/`L` commands per unbroken run
 * of priced bars. A run of a single bar repeats its own point so a round
 * stroke cap renders it as a dot — an observation stranded between two gaps
 * is still an observation, and a lone `M` would draw nothing at all.
 */
function pathRuns(
  series: readonly PriceChartBar[],
  geometry: PriceChartGeometry,
): string[] {
  const runs: string[] = []
  let current: string[] = []
  const close = () => {
    if (!current.length) return
    runs.push(current.length === 1 ? `${current[0]}L${current[0]!.slice(1)}` : current.join(""))
    current = []
  }
  series.forEach((bar, index) => {
    const value = priceChartBarValue(bar)
    if (value === null) {
      close()
      return
    }
    const x = priceChartPointX(index, geometry).toFixed(2)
    const y = priceChartValueY(value, geometry).toFixed(2)
    current.push(`${current.length ? "L" : "M"}${x},${y}`)
  })
  close()
  return runs
}

/**
 * The `d` attribute for the price line. A bar with no price breaks the run
 * and the next bar starts a fresh subpath, so a gap in the data reads as a
 * gap rather than a straight line through it. A single-bar series draws a
 * flat line across the box so a just-opened session still shows a price.
 */
export function priceChartLinePath(
  series: readonly PriceChartBar[],
  geometry: PriceChartGeometry,
): string {
  if (geometry.count === 1) {
    const value = priceChartBarValue(series[0] as PriceChartBar)
    if (value === null) return ""
    const y = priceChartValueY(value, geometry).toFixed(2)
    return `M0.00,${y}L${geometry.width.toFixed(2)},${y}`
  }
  return pathRuns(series, geometry).join("")
}

/**
 * The `d` attribute for the tone-colored wash under the line: the same run of
 * points, closed down to the bottom of the box. Returns an empty string when
 * there is nothing to fill.
 */
export function priceChartAreaPath(
  series: readonly PriceChartBar[],
  geometry: PriceChartGeometry,
): string {
  if (geometry.count === 1) {
    const line = priceChartLinePath(series, geometry)
    if (!line) return ""
    const floor = geometry.height.toFixed(2)
    return `${line}L${geometry.width.toFixed(2)},${floor}L0.00,${floor}Z`
  }
  // Each run closes to the floor on its own. Closing only the last one would
  // shade straight across the gaps the line deliberately leaves empty.
  return pathRuns(series, geometry)
    .map((run) => {
      const points = run.slice(1).split("L")
      const startX = (points[0] as string).split(",")[0] as string
      const endX = (points[points.length - 1] as string).split(",")[0] as string
      const floor = geometry.height.toFixed(2)
      return `${run}L${endX},${floor}L${startX},${floor}Z`
    })
    .join("")
}

/** The pixel rectangle and wick of one candle. */
export interface PriceChartCandle {
  index: number
  /** Left edge of the candle body. */
  x: number
  /** Body width in pixels. */
  width: number
  /** Horizontal center, where the wick is drawn. */
  center: number
  /** Top of the body — the higher of open and close. */
  bodyY: number
  /** Body height, floored at one pixel so a doji stays visible. */
  bodyHeight: number
  /** Top of the wick. */
  highY: number
  /** Bottom of the wick. */
  lowY: number
  /** The direction the interval closed in: up, down, or unchanged. */
  tone: PriceChartTone
}

/**
 * Lays out one candle per bar that carries a full OHLC set. Bodies take at
 * most 70% of a slot and are capped at 18 pixels so a short series reads as
 * candles rather than blocks; bars without OHLC are skipped.
 */
export function priceChartCandles(
  series: readonly PriceChartBar[],
  geometry: PriceChartGeometry,
): PriceChartCandle[] {
  if (geometry.count === 0) return []
  const slot = geometry.width / geometry.count
  const width = Math.max(1, Math.min(slot * 0.7, 18))
  const candles: PriceChartCandle[] = []
  series.forEach((bar, index) => {
    if (!priceChartIsCandle(bar)) return
    const open = bar.open as number
    const close = bar.close as number
    const center = slot * index + slot / 2
    const openY = priceChartValueY(open, geometry)
    const closeY = priceChartValueY(close, geometry)
    const bodyY = Math.min(openY, closeY)
    candles.push({
      index,
      x: center - width / 2,
      width,
      center,
      bodyY,
      bodyHeight: Math.max(1, Math.abs(openY - closeY)),
      highY: priceChartValueY(bar.high as number, geometry),
      lowY: priceChartValueY(bar.low as number, geometry),
      tone: close === open ? "neutral" : close > open ? "gain" : "loss",
    })
  })
  return candles
}

/**
 * The bar nearest a pointer position, in the same coordinate space the view
 * uses: candles are slot-centered, the line is spread edge to edge. Returns
 * `-1` when no bar can be resolved — an empty series, or a plot that has not
 * been measured yet, where every position would otherwise collapse onto the
 * first bar and anchor a gesture there.
 */
export function priceChartIndexAt(
  x: number,
  geometry: PriceChartGeometry,
  view: PriceChartView = "line",
): number {
  if (geometry.count === 0 || geometry.width === 0) return -1
  if (geometry.count === 1) return 0
  const ratio =
    view === "candle"
      ? (x / geometry.width) * geometry.count - 0.5
      : (x / geometry.width) * (geometry.count - 1)
  return Math.max(0, Math.min(geometry.count - 1, Math.round(ratio)))
}

/**
 * The market direction of `current` against `reference`. An exactly flat move
 * is neutral, which is also the tone used when no reference is known.
 */
export function priceChartTone(
  current: number | null | undefined,
  reference: number | null | undefined,
): PriceChartTone {
  if (
    typeof current !== "number" ||
    typeof reference !== "number" ||
    !Number.isFinite(current) ||
    !Number.isFinite(reference) ||
    current === reference
  ) {
    return "neutral"
  }
  return current > reference ? "gain" : "loss"
}

/**
 * The tone a series carries on its own: its last plotted price against
 * `baseline` when the host supplies one, otherwise against its first price.
 */
export function priceChartSeriesTone(
  series: readonly PriceChartBar[],
  baseline?: number,
): PriceChartTone {
  const values = series
    .map(priceChartBarValue)
    .filter((value): value is number => value !== null)
  if (!values.length) return "neutral"
  const reference =
    typeof baseline === "number" && Number.isFinite(baseline)
      ? baseline
      : (values[0] as number)
  return priceChartTone(values[values.length - 1] as number, reference)
}

/**
 * A chosen window of the series, as inclusive bar indices. `start` is always
 * the earlier bar once the selection has been normalized.
 */
export interface PriceChartSelection {
  start: number
  end: number
}

/**
 * Clamps a selection to the series and orders its ends, so a drag that runs
 * right to left or past the edge still describes a real window. Returns
 * `null` when the series cannot carry the selection at all.
 */
export function priceChartNormalizeSelection(
  selection: PriceChartSelection | null | undefined,
  count: number,
): PriceChartSelection | null {
  if (!selection || count <= 0) return null
  const clamp = (value: number) =>
    Math.max(0, Math.min(count - 1, Math.round(value)))
  const start = clamp(selection.start)
  const end = clamp(selection.end)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

/** The pixel band a selection covers, including its outermost bars' width. */
export interface PriceChartSelectionBounds {
  left: number
  right: number
  width: number
}

/**
 * The pixel band for a selection. Each end reaches half a bar past its own
 * centre so the outermost bars sit inside the window rather than on its edge,
 * and the band is clipped to the plot.
 */
export function priceChartSelectionBounds(
  selection: PriceChartSelection,
  geometry: PriceChartGeometry,
  view: PriceChartView = "line",
): PriceChartSelectionBounds {
  const slot = geometry.count > 0 ? geometry.width / geometry.count : 0
  const centre = (index: number) =>
    view === "candle" ? slot * index + slot / 2 : priceChartPointX(index, geometry)
  const half =
    view === "candle"
      ? slot / 2
      : geometry.count > 1
        ? geometry.width / (geometry.count - 1) / 2
        : geometry.width / 2
  const left = Math.max(0, centre(selection.start) - half)
  const right = Math.min(geometry.width, centre(selection.end) + half)
  return { left, right, width: Math.max(0, right - left) }
}

/** The move across a selected window. */
export interface PriceChartChange {
  /** The move in the series' own price units. */
  amount: number
  /** The same move as a percentage, on a 0–100 scale rather than 0–1. */
  percent: number
}

/**
 * The change between the first and last plotted price inside a window. Both
 * ends scan inward past bars that carry no price, so a window whose outer
 * bars are gaps still reports the move its prices actually made; `null` means
 * the window holds no price at all.
 */
export function priceChartSelectionChange(
  series: readonly PriceChartBar[],
  selection: PriceChartSelection,
): PriceChartChange | null {
  // Bounds-checked rather than trusting the window: this is a public helper,
  // and a host holding a window it saved earlier can hand it a series that
  // has since grown shorter.
  const first = Math.max(0, selection.start)
  const last = Math.min(series.length - 1, selection.end)
  let from: number | null = null
  for (let index = first; index <= last; index += 1) {
    from = priceChartBarValue(series[index] as PriceChartBar)
    if (from !== null) break
  }
  let to: number | null = null
  for (let index = last; index >= first; index -= 1) {
    to = priceChartBarValue(series[index] as PriceChartBar)
    if (to !== null) break
  }
  if (from === null || to === null) return null
  const amount = to - from
  return { amount, percent: from === 0 ? 0 : (amount / from) * 100 }
}

/** A labelled position on an axis, in the plot's own pixel space. */
export interface PriceChartTick {
  /** The value a price tick reads, or the timestamp a time tick reads. */
  value: number
  /** Distance along the axis in pixels, from the plot's top or left edge. */
  offset: number
  /** The same position as a 0–1 ratio, for percentage-positioned labels. */
  ratio: number
}

/**
 * The nearest 1/2/5/10 step to `rough`, so ticks land on readable values
 * without thinning out: the thresholds are the geometric midpoints between
 * the candidates, which is what keeps a 2.25 step at 2 rather than 5.
 */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const step =
    normalized >= Math.sqrt(50)
      ? 10
      : normalized >= Math.sqrt(10)
        ? 5
        : normalized >= Math.sqrt(2)
          ? 2
          : 1
  return step * magnitude
}

/**
 * Price ticks across the plotted extent, snapped to readable 1/2/5/10 steps.
 * `count` is the number of intervals asked for, not a pixel spacing, and the
 * step is rounded to the nearest readable value, so the tick count lands near
 * it rather than on it. Ticks that would sit within four pixels of an edge are
 * dropped so a label never collides with the plot's boundary.
 */
export function priceChartValueTicks(
  geometry: PriceChartGeometry,
  count = 4,
): PriceChartTick[] {
  const span = geometry.max - geometry.min
  // No bars, no scale: an empty plot has nothing for a price to label.
  if (geometry.count === 0) return []
  if (!(span > 0) || geometry.height <= 0 || count < 1) return []
  const step = niceStep(span / count)
  const ticks: PriceChartTick[] = []
  for (
    let value = Math.ceil(geometry.min / step) * step;
    value <= geometry.max + step / 1000;
    value += step
  ) {
    const offset = priceChartValueY(value, geometry)
    if (offset < 4 || offset > geometry.height - 4) continue
    ticks.push({
      value: Number(value.toFixed(10)),
      offset,
      ratio: offset / geometry.height,
    })
  }
  return ticks
}

/**
 * Time ticks along the plotted window: about `count` evenly spaced bars,
 * always including the first and last, reported with the timestamp each one
 * carries. Bars are index-spaced, so the labels are too.
 */
export function priceChartTimeTicks(
  series: readonly PriceChartBar[],
  geometry: PriceChartGeometry,
  count = 4,
  view: PriceChartView = "line",
): PriceChartTick[] {
  if (!series.length || geometry.width <= 0 || count < 2) return []
  const slot = geometry.width / Math.max(1, geometry.count)
  const centre = (index: number) =>
    view === "candle" ? slot * index + slot / 2 : priceChartPointX(index, geometry)
  const last = series.length - 1
  const steps = Math.min(count - 1, last)
  if (steps <= 0) {
    const only = series[0] as PriceChartBar
    return [{ value: only.time, offset: centre(0), ratio: centre(0) / geometry.width }]
  }
  const seen = new Set<number>()
  const ticks: PriceChartTick[] = []
  for (let step = 0; step <= steps; step += 1) {
    const index = Math.round((last * step) / steps)
    if (seen.has(index)) continue
    seen.add(index)
    const offset = centre(index)
    ticks.push({
      value: (series[index] as PriceChartBar).time,
      offset,
      ratio: offset / geometry.width,
    })
  }
  return ticks
}
