import assert from "node:assert/strict"
import test from "node:test"

import {
  priceChartAreaPath,
  priceChartBarValue,
  priceChartCandles,
  priceChartExtent,
  priceChartGeometry,
  priceChartHasCandles,
  priceChartIndexAt,
  priceChartLinePath,
  priceChartNormalizeSelection,
  priceChartPointX,
  priceChartSelectionBounds,
  priceChartSelectionChange,
  priceChartTimeTicks,
  priceChartSeriesTone,
  priceChartTone,
  priceChartValueTicks,
  priceChartValueY,
  type PriceChartBar,
} from "./price-chart-math"

const line: PriceChartBar[] = [
  { time: 0, value: 10 },
  { time: 1, value: 20 },
  { time: 2, value: 15 },
]

const candles: PriceChartBar[] = [
  { time: 0, open: 10, high: 12, low: 9, close: 11 },
  { time: 1, open: 11, high: 11.5, low: 8, close: 9 },
]

const geometryFor = (series: PriceChartBar[], view: "line" | "candle" = "line") =>
  priceChartGeometry({ width: 100, height: 100, series, view, inset: 0 })

test("a bar's plotted price falls back from value to close to open", () => {
  assert.equal(priceChartBarValue({ time: 0, value: 3, close: 4 }), 3)
  assert.equal(priceChartBarValue({ time: 0, close: 4 }), 4)
  assert.equal(priceChartBarValue({ time: 0, open: 5 }), 5)
  assert.equal(priceChartBarValue({ time: 0 }), null)
})

test("the extent covers the drawn values and always includes the baseline", () => {
  assert.deepEqual(priceChartExtent(line), { min: 10, max: 20 })
  assert.deepEqual(priceChartExtent(line, "line", 5), { min: 5, max: 20 })
  // Candles are measured on their wicks, not their bodies.
  assert.deepEqual(priceChartExtent(candles, "candle"), { min: 8, max: 12 })
})

test("a flat series is widened so it draws through the middle", () => {
  const extent = priceChartExtent([{ time: 0, value: 100 }])
  assert.ok(extent.min < 100 && extent.max > 100)
  const geometry = priceChartGeometry({
    width: 100,
    height: 100,
    series: [{ time: 0, value: 100 }],
    inset: 0,
  })
  assert.equal(priceChartValueY(100, geometry), 50)
})

test("an empty series still yields a usable extent", () => {
  assert.deepEqual(priceChartExtent([]), { min: 0, max: 1 })
})

test("bars are spaced by index and a lone bar sits in the middle", () => {
  const geometry = geometryFor(line)
  assert.equal(priceChartPointX(0, geometry), 0)
  assert.equal(priceChartPointX(2, geometry), 100)
  assert.equal(priceChartPointX(0, geometryFor([line[0] as PriceChartBar])), 50)
})

test("values map to pixels inside the inset band, high prices on top", () => {
  const geometry = priceChartGeometry({
    width: 100,
    height: 100,
    series: line,
    inset: 10,
  })
  assert.equal(priceChartValueY(20, geometry), 10)
  assert.equal(priceChartValueY(10, geometry), 90)
  assert.equal(priceChartValueY(15, geometry), 50)
})

test("the inset can never eat more than half the box", () => {
  const geometry = priceChartGeometry({
    width: 100,
    height: 20,
    series: line,
    inset: 40,
  })
  assert.equal(geometry.inset, 5)
})

test("the line path breaks at a bar with no price", () => {
  const geometry = geometryFor(line)
  assert.equal(
    priceChartLinePath(line, geometry),
    "M0.00,100.00L50.00,0.00L100.00,50.00",
  )
  // Each stranded observation repeats its own point so a round cap draws it
  // as a dot; a lone move command would render nothing at all.
  const gapped = [line[0] as PriceChartBar, { time: 1 }, line[2] as PriceChartBar]
  assert.equal(
    priceChartLinePath(gapped, priceChartGeometry({ width: 100, height: 100, series: gapped, inset: 0 })),
    "M0.00,100.00L0.00,100.00M100.00,0.00L100.00,0.00",
  )
})

test("the area closes every run to the floor, never across a gap", () => {
  const gapped: PriceChartBar[] = [
    { time: 0, value: 10 },
    { time: 1, value: 12 },
    { time: 2 },
    { time: 3, value: 18 },
    { time: 4, value: 20 },
  ]
  const geometry = priceChartGeometry({
    width: 100,
    height: 100,
    series: gapped,
    inset: 0,
  })
  const area = priceChartAreaPath(gapped, geometry)
  // Two closed subpaths, one per run — not one shape spanning the gap.
  assert.equal(area.split("Z").length - 1, 2)
  assert.ok(area.includes("M0.00,100.00L25.00,80.00L25.00,100.00L0.00,100.00Z"))
  assert.ok(area.includes("M75.00,20.00L100.00,0.00L100.00,100.00L75.00,100.00Z"))
})

test("a single bar draws a flat line across the box", () => {
  const single = [{ time: 0, value: 4 }]
  const geometry = geometryFor(single)
  assert.equal(priceChartLinePath(single, geometry), "M0.00,50.00L100.00,50.00")
})

test("the area path closes the line down to the bottom edge", () => {
  const geometry = geometryFor(line)
  const area = priceChartAreaPath(line, geometry)
  assert.ok(area.startsWith(priceChartLinePath(line, geometry)))
  assert.ok(area.endsWith("L100.00,100.00L0.00,100.00Z"))
  assert.equal(priceChartAreaPath([], geometryFor([])), "")
})

test("candles are slot-centred, capped in width, and toned by direction", () => {
  const geometry = geometryFor(candles, "candle")
  const laid = priceChartCandles(candles, geometry)
  assert.equal(laid.length, 2)
  assert.equal(laid[0]?.center, 25)
  assert.equal(laid[1]?.center, 75)
  assert.equal(laid[0]?.width, 18)
  assert.equal(laid[0]?.tone, "gain")
  assert.equal(laid[1]?.tone, "loss")
  // The high wick sits above the body top.
  assert.ok((laid[0]?.highY as number) < (laid[0]?.bodyY as number))
})

test("a doji keeps a visible body", () => {
  const doji: PriceChartBar[] = [
    { time: 0, open: 10, high: 11, low: 9, close: 10 },
  ]
  const laid = priceChartCandles(doji, geometryFor(doji, "candle"))
  assert.equal(laid[0]?.bodyHeight, 1)
  assert.equal(laid[0]?.tone, "neutral")
})

test("bars without a full OHLC set are skipped by the candle layout", () => {
  const mixed = [candles[0] as PriceChartBar, { time: 2, value: 10 }]
  assert.equal(priceChartHasCandles(mixed), false)
  assert.equal(priceChartCandles(mixed, geometryFor(mixed, "candle")).length, 1)
  assert.equal(priceChartHasCandles(candles), true)
  assert.equal(priceChartHasCandles([]), false)
})

test("the cursor resolves the nearest bar in each view's own spacing", () => {
  const lineGeometry = geometryFor(line)
  assert.equal(priceChartIndexAt(0, lineGeometry), 0)
  assert.equal(priceChartIndexAt(49, lineGeometry), 1)
  assert.equal(priceChartIndexAt(120, lineGeometry), 2)
  const candleGeometry = geometryFor(candles, "candle")
  assert.equal(priceChartIndexAt(10, candleGeometry, "candle"), 0)
  assert.equal(priceChartIndexAt(80, candleGeometry, "candle"), 1)
  assert.equal(priceChartIndexAt(10, geometryFor([]), "line"), -1)
  // An unmeasured plot resolves no bar at all, so a press that lands before
  // the first measurement cannot silently anchor on the first one.
  assert.equal(
    priceChartIndexAt(
      10,
      priceChartGeometry({ width: 0, height: 0, series: line }),
      "line",
    ),
    -1,
  )
})

test("tone compares against the reference and stays neutral when flat", () => {
  assert.equal(priceChartTone(2, 1), "gain")
  assert.equal(priceChartTone(1, 2), "loss")
  assert.equal(priceChartTone(1, 1), "neutral")
  assert.equal(priceChartTone(1, null), "neutral")
  assert.equal(priceChartTone(Number.NaN, 1), "neutral")
})

test("a series tones itself against the baseline, else its first price", () => {
  assert.equal(priceChartSeriesTone(line), "gain")
  assert.equal(priceChartSeriesTone(line, 30), "loss")
  assert.equal(priceChartSeriesTone([]), "neutral")
})

test("a selection is ordered and clamped to the series", () => {
  assert.deepEqual(priceChartNormalizeSelection({ start: 2, end: 0 }, 3), {
    start: 0,
    end: 2,
  })
  assert.deepEqual(priceChartNormalizeSelection({ start: -4, end: 9 }, 3), {
    start: 0,
    end: 2,
  })
  assert.equal(priceChartNormalizeSelection(null, 3), null)
  assert.equal(priceChartNormalizeSelection({ start: 0, end: 1 }, 0), null)
})

test("a selection band reaches half a bar past each end", () => {
  const geometry = geometryFor(line)
  const bounds = priceChartSelectionBounds({ start: 1, end: 2 }, geometry)
  // Bar 1 sits at x=50 and bar 2 at x=100, so the band opens 25px earlier
  // and is clipped at the plot's right edge.
  assert.equal(bounds.left, 25)
  assert.equal(bounds.right, 100)
  assert.equal(bounds.width, 75)
  const single = priceChartSelectionBounds({ start: 0, end: 0 }, geometry)
  assert.equal(single.left, 0)
  assert.equal(single.width, 25)
})

test("a candle band covers whole slots", () => {
  const geometry = geometryFor(candles, "candle")
  const bounds = priceChartSelectionBounds(
    { start: 0, end: 1 },
    geometry,
    "candle",
  )
  assert.equal(bounds.left, 0)
  assert.equal(bounds.right, 100)
})

test("a selection reports the move across its own window", () => {
  assert.deepEqual(priceChartSelectionChange(line, { start: 0, end: 1 }), {
    amount: 10,
    percent: 100,
  })
  const flat = priceChartSelectionChange(line, { start: 1, end: 1 })
  assert.equal(flat?.amount, 0)
  assert.equal(
    priceChartSelectionChange([{ time: 0 }], { start: 0, end: 0 }),
    null,
  )
})

test("price ticks snap to readable steps inside the extent", () => {
  const geometry = geometryFor(line)
  const ticks = priceChartValueTicks(geometry, 4)
  // A 10-to-20 extent over four intervals asks for a 2.5 step and takes the
  // nearest readable one, 2. The ticks that would land exactly on the plot's
  // edges are dropped.
  assert.deepEqual(
    ticks.map((tick) => tick.value),
    [12, 14, 16, 18],
  )
  // Higher values sit nearer the top of the plot.
  assert.ok((ticks[0]?.offset as number) > (ticks[3]?.offset as number))
  assert.deepEqual(priceChartValueTicks(geometryFor([]), 4), [])
})

test("price ticks never land on the plot's own edges", () => {
  const geometry = geometryFor(line)
  for (const tick of priceChartValueTicks(geometry, 12)) {
    assert.ok(tick.offset >= 4 && tick.offset <= geometry.height - 4)
  }
})

test("time ticks always include both ends of the window", () => {
  const geometry = geometryFor(line)
  const ticks = priceChartTimeTicks(line, geometry, 3)
  assert.deepEqual(
    ticks.map((tick) => tick.value),
    [0, 1, 2],
  )
  assert.equal(ticks[0]?.ratio, 0)
  assert.equal(ticks[2]?.ratio, 1)
  // More labels than bars collapses to one per bar, never duplicates.
  assert.equal(priceChartTimeTicks(line, geometry, 9).length, 3)
  assert.deepEqual(priceChartTimeTicks([], geometry, 4), [])
})

test("a window's change scans inward past gaps at either end", () => {
  const gapped: PriceChartBar[] = [
    { time: 0 },
    { time: 1, value: 10 },
    { time: 2, value: 14 },
    { time: 3 },
  ]
  // The outer bars carry no price, so the move is the one its prices made.
  assert.deepEqual(priceChartSelectionChange(gapped, { start: 0, end: 3 }), {
    amount: 4,
    percent: 40,
  })
  // A window that reaches past the series it is measured against is clamped
  // rather than throwing: a host can hold a window a shorter feed outgrew.
  assert.deepEqual(priceChartSelectionChange(line, { start: 0, end: 99 }), {
    amount: 5,
    percent: 50,
  })
  assert.equal(priceChartSelectionChange(line, { start: 7, end: 9 }), null)
})

test("a single-bar window of time ticks reports that one bar", () => {
  const only = [line[0] as PriceChartBar]
  const ticks = priceChartTimeTicks(only, geometryFor(only), 4)
  assert.equal(ticks.length, 1)
  assert.equal(ticks[0]?.value, 0)
  assert.equal(ticks[0]?.offset, 50)
})
