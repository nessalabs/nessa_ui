/** @responsibility Verifies the shared chart geometry: ticks, scales, step and line paths, proportion weights, and tooltip placement. */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  bestSoFar,
  intersectChartRects,
  linePath,
  linearScale,
  MAX_TICK_COUNT,
  niceTicks,
  placeChartTooltip,
  proportionWeights,
  stepChanges,
  stepPath,
  type ChartScale,
  type ChartTooltipPlacementInput,
} from "./chart-geometry"

/** Identity on x, and y as-is, so path data reads in data units. */
const IDENTITY: ChartScale = { x: (value) => value, y: (value) => value }

describe("linearScale", () => {
  it("maps the domain onto the range, including a reversed range", () => {
    const y = linearScale([0, 100], [200, 0])
    assert.equal(y(0), 200)
    assert.equal(y(100), 0)
    assert.equal(y(25), 150)
  })

  it("maps every value to the middle of the range for a zero-width domain", () => {
    const x = linearScale([5, 5], [0, 80])
    assert.equal(x(5), 40)
    assert.equal(x(-3), 40)
  })
})

describe("niceTicks", () => {
  it("covers 0..100 in round steps", () => {
    assert.deepEqual(niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100])
  })

  it("bounds the data rather than starting at zero", () => {
    // The prototype's 0-100-in-fives assumption would put a 71.2..78.9 series
    // on a mostly empty axis.
    assert.deepEqual(niceTicks(71.2, 78.9, 4), [70, 72, 74, 76, 78, 80])
  })

  it("works on fractional ranges without floating-point residue", () => {
    const ticks = niceTicks(0.1, 0.72, 6)
    assert.deepEqual(ticks, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8])
    for (const tick of ticks) assert.equal(String(tick).length <= 3, true)
  })

  it("works on negative and very large ranges", () => {
    assert.deepEqual(niceTicks(-37, 12, 5), [-40, -30, -20, -10, 0, 10, 20])
    assert.deepEqual(niceTicks(0, 4_200_000, 4), [0, 1e6, 2e6, 3e6, 4e6, 5e6])
  })

  it("swaps reversed bounds", () => {
    assert.deepEqual(niceTicks(100, 0, 5), niceTicks(0, 100, 5))
  })

  it("widens a flat range so it still has an axis", () => {
    assert.deepEqual(niceTicks(0, 0, 4), [0, 0.2, 0.4, 0.6, 0.8, 1])
    const ticks = niceTicks(50, 50, 4)
    assert.ok(ticks[0]! <= 45 && ticks[ticks.length - 1]! >= 55, `${ticks}`)
  })

  it("gives no ticks for a non-finite bound and clamps the count", () => {
    assert.deepEqual(niceTicks(Number.NaN, 10, 5), [])
    assert.deepEqual(niceTicks(0, Number.POSITIVE_INFINITY, 5), [])
    assert.deepEqual(niceTicks(0, 10, 0), [0, 10])
  })

  it("never loops, repeats or overflows where floating point cannot step evenly", () => {
    // Nanosecond timestamps over a narrow window: the index passes 2^53.
    assert.deepEqual(niceTicks(1.7e18, 1.7e18 + 256, 5), [1.7e18, 1.7e18 + 256])
    const wider = niceTicks(1.7e18, 1.7e18 + 1000, 5)
    assert.equal(new Set(wider).size, wider.length)
    // Too wide to measure: the span itself is infinite.
    assert.deepEqual(niceTicks(-1e308, 1e308, 5), [-1e308, 1e308])
    // A step below the smallest normal double.
    const tiny = niceTicks(0, 1e-310, 5)
    assert.ok(tiny.every(Number.isFinite))
    assert.equal(new Set(tiny).size, tiny.length)
  })

  it("keeps a flat range finite at the edges of the number line", () => {
    for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
      const ticks = niceTicks(value, value, 5)
      assert.ok(ticks.length >= 2, `${ticks}`)
      assert.ok(ticks.every(Number.isFinite), `${ticks}`)
      assert.ok(ticks[0]! <= value && ticks[ticks.length - 1]! >= value)
    }
    assert.ok(niceTicks(0, Number.MAX_VALUE, 5).every(Number.isFinite))
    assert.ok(niceTicks(-Number.MAX_VALUE, Number.MAX_VALUE, 5).every(Number.isFinite))
  })

  it("widens a flat range at zero to [0, 1]", () => {
    const ticks = niceTicks(0, 0, 5)
    assert.equal(ticks[0], 0)
    assert.equal(ticks[ticks.length - 1], 1)
  })

  it("caps the tick count", () => {
    const limit = Math.ceil(MAX_TICK_COUNT * Math.SQRT2) + 2
    assert.ok(niceTicks(0, 1, 1e6).length <= limit)
    assert.ok(niceTicks(0, 1.41, MAX_TICK_COUNT).length <= limit)
    assert.deepEqual(niceTicks(0, 1, 1e6), niceTicks(0, 1, MAX_TICK_COUNT))
  })

  it("gives one tick for a value too small to widen", () => {
    assert.deepEqual(niceTicks(5e-324, 5e-324, 5), [5e-324])
  })

  it("first and last tick always bound the input", () => {
    for (const [min, max] of [
      [3, 97],
      [-0.004, 0.013],
      [12_345, 67_890],
      [-5, -1],
    ] as const) {
      const ticks = niceTicks(min, max, 5)
      assert.ok(ticks[0]! <= min, `${ticks} starts above ${min}`)
      assert.ok(ticks[ticks.length - 1]! >= max, `${ticks} ends below ${max}`)
    }
  })
})

describe("bestSoFar", () => {
  const points = [
    { x: 1, y: 50 },
    { x: 2, y: 48 },
    { x: 3, y: 55 },
    { x: 4, y: 55 },
    { x: 5, y: 61 },
  ]

  it("keeps the running maximum when better is up", () => {
    assert.deepEqual(bestSoFar(points, "up"), [
      { x: 1, y: 50 },
      { x: 3, y: 55 },
      { x: 5, y: 61 },
    ])
  })

  it("keeps the running minimum when better is down", () => {
    assert.deepEqual(bestSoFar(points, "down"), [
      { x: 1, y: 50 },
      { x: 2, y: 48 },
    ])
  })

  it("orders by x and ignores unplottable points", () => {
    assert.deepEqual(
      bestSoFar(
        [
          { x: 3, y: 9 },
          { x: Number.NaN, y: 100 },
          { x: 1, y: 4 },
          { x: 2, y: Number.POSITIVE_INFINITY },
        ],
        "up",
      ),
      [
        { x: 1, y: 4 },
        { x: 3, y: 9 },
      ],
    )
  })
})

describe("stepPath", () => {
  it("steps up only at records and carries on to the last point", () => {
    const path = stepPath(
      [
        { x: 0, y: 10 },
        { x: 1, y: 8 },
        { x: 2, y: 14 },
        { x: 3, y: 12 },
      ],
      IDENTITY,
      { better: "up" },
    )
    assert.equal(path, "M0,10H2V14H3")
  })

  it("steps through the points exactly as given without better", () => {
    // A best-so-far owned by the caller that falls when a best is withdrawn:
    // nothing is recomputed, so the fall is drawn.
    const path = stepPath(
      [
        { x: 0, y: 10 },
        { x: 1, y: 10 },
        { x: 2, y: 14 },
        { x: 3, y: 12 },
        { x: 4, y: 12 },
      ],
      IDENTITY,
    )
    assert.equal(path, "M0,10H2V14H3V12H4")
  })

  it("keeps the given order without better", () => {
    assert.equal(
      stepPath(
        [
          { x: 0, y: 1 },
          { x: 2, y: 3 },
          { x: 1, y: 2 },
        ],
        IDENTITY,
      ),
      "M0,1H2V3H1V2",
    )
  })

  it("steps down for better down", () => {
    const path = stepPath(
      [
        { x: 0, y: 900 },
        { x: 1, y: 700 },
        { x: 2, y: 800 },
        { x: 3, y: 400 },
      ],
      IDENTITY,
      { better: "down" },
    )
    assert.equal(path, "M0,900H1V700H3V400")
  })

  it("runs on to until, and never backwards", () => {
    const points = [
      { x: 0, y: 1 },
      { x: 4, y: 2 },
    ]
    assert.equal(stepPath(points, IDENTITY, { until: 10 }), "M0,1H4V2H10")
    assert.equal(stepPath(points, IDENTITY, { until: 2 }), "M0,1H4V2")
  })

  it("maps through the scale", () => {
    const scale: ChartScale = {
      x: linearScale([0, 2], [0, 200]),
      y: linearScale([0, 10], [100, 0]),
    }
    assert.equal(
      stepPath(
        [
          { x: 0, y: 0 },
          { x: 2, y: 10 },
        ],
        scale,
      ),
      "M0,100H200V0",
    )
  })

  it("is empty with nothing to plot", () => {
    assert.equal(stepPath([], IDENTITY), "")
    assert.equal(stepPath([{ x: Number.NaN, y: 1 }], IDENTITY), "")
  })
})

describe("stepChanges", () => {
  it("keeps the first point and every change of value, in the given order", () => {
    assert.deepEqual(
      stepChanges([
        { x: 0, y: 5 },
        { x: 1, y: 5 },
        { x: 2, y: 7 },
        { x: 3, y: 6 },
        { x: 4, y: Number.NaN },
        { x: 5, y: 6 },
      ]),
      [
        { x: 0, y: 5 },
        { x: 2, y: 7 },
        { x: 3, y: 6 },
      ],
    )
    assert.deepEqual(stepChanges([]), [])
  })
})

describe("linePath", () => {
  it("joins every point in x order", () => {
    assert.equal(
      linePath(
        [
          { x: 2, y: 5 },
          { x: 0, y: 1 },
          { x: 1, y: 3 },
        ],
        IDENTITY,
      ),
      "M0,1L1,3L2,5",
    )
    assert.equal(linePath([], IDENTITY), "")
  })
})

describe("proportionWeights", () => {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

  it("gives plain shares when linear", () => {
    assert.deepEqual(proportionWeights([1, 3], "linear"), [0.25, 0.75])
  })

  it("gives a tiny value a visible share when log", () => {
    const [tiny, large] = proportionWeights([3, 12_000], "log")
    assert.ok(tiny! > 0.07, `tiny weight ${tiny}`)
    assert.ok(large! > tiny!)
    assert.ok(Math.abs(sum([tiny!, large!]) - 1) < 1e-12)
  })

  it("keeps order and equality under log", () => {
    const weights = proportionWeights([5, 5, 50, 500], "log")
    assert.equal(weights[0], weights[1])
    assert.ok(weights[1]! < weights[2]! && weights[2]! < weights[3]!)
  })

  it("is independent of units under log", () => {
    const counts = proportionWeights([2, 30, 400], "log")
    const scaled = proportionWeights([0.002, 0.03, 0.4], "log")
    counts.forEach((weight, index) =>
      assert.ok(Math.abs(weight - scaled[index]!) < 1e-12),
    )
  })

  it("stays finite and sums to 1 at extreme magnitudes", () => {
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
    assert.deepEqual(proportionWeights([1e308, 1e308], "linear"), [0.5, 0.5])
    for (const weight of proportionWeights(
      [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
      "log",
    )) {
      assert.ok(Math.abs(weight - 1 / 3) < 1e-12)
    }
    for (const values of [
      [1e-308, 1e308],
      [Number.MIN_VALUE, Number.MAX_VALUE],
      [5e-324, 1, 1e308],
    ]) {
      for (const weighting of ["linear", "log"] as const) {
        const weights = proportionWeights(values, weighting)
        assert.ok(weights.every(Number.isFinite), `${weighting} ${weights}`)
        assert.ok(Math.abs(sum(weights) - 1) < 1e-12, `${weighting} ${weights}`)
      }
      const log = proportionWeights(values, "log")
      for (let index = 1; index < log.length; index += 1) {
        assert.ok(log[index]! > log[index - 1]!, `log order ${log}`)
      }
    }
  })

  it("weighs zero, negative and non-finite values as nothing", () => {
    assert.deepEqual(proportionWeights([0, -4, Number.NaN, 2], "log"), [0, 0, 0, 1])
    assert.deepEqual(proportionWeights([0, 0], "linear"), [0, 0])
    assert.deepEqual(proportionWeights([], "log"), [])
  })
})

describe("placeChartTooltip", () => {
  const BOUNDARY = { left: 0, top: 0, width: 400, height: 200 }
  const base: ChartTooltipPlacementInput = {
    anchor: { x: 200, y: 100 },
    size: { width: 120, height: 60 },
    boundary: BOUNDARY,
    side: "right",
    offset: 10,
    padding: 8,
  }

  /** Asserts the whole card sits inside the padded boundary. */
  function assertInside(input: ChartTooltipPlacementInput) {
    const placed = placeChartTooltip(input)
    const { boundary, padding, size } = input
    assert.ok(placed.x >= boundary.left + padding, `left ${placed.x}`)
    assert.ok(placed.y >= boundary.top + padding, `top ${placed.y}`)
    assert.ok(
      placed.x + size.width <= boundary.left + boundary.width - padding,
      `right ${placed.x + size.width}`,
    )
    assert.ok(
      placed.y + size.height <= boundary.top + boundary.height - padding,
      `bottom ${placed.y + size.height}`,
    )
    return placed
  }

  it("takes the preferred side, centred across it, when it fits", () => {
    assert.deepEqual(placeChartTooltip(base), { x: 210, y: 70, side: "right" })
    assert.deepEqual(placeChartTooltip({ ...base, side: "top" }), {
      x: 140,
      y: 30,
      side: "top",
    })
  })

  it("flips at the right edge", () => {
    const placed = assertInside({ ...base, anchor: { x: 380, y: 100 } })
    assert.equal(placed.side, "left")
    assert.equal(placed.x, 380 - 10 - 120)
  })

  it("flips at the left edge", () => {
    const placed = assertInside({ ...base, side: "left", anchor: { x: 20, y: 100 } })
    assert.equal(placed.side, "right")
  })

  it("flips at the top and bottom edges", () => {
    assert.equal(
      assertInside({ ...base, side: "top", anchor: { x: 200, y: 12 } }).side,
      "bottom",
    )
    assert.equal(
      assertInside({ ...base, side: "bottom", anchor: { x: 200, y: 190 } }).side,
      "top",
    )
  })

  it("shifts across the axis at every corner", () => {
    for (const anchor of [
      { x: 4, y: 4 },
      { x: 396, y: 4 },
      { x: 4, y: 196 },
      { x: 396, y: 196 },
    ]) {
      for (const side of ["top", "right", "bottom", "left"] as const) {
        assertInside({ ...base, anchor, side })
      }
    }
  })

  it("stays inside when the anchor is outside the boundary", () => {
    assertInside({ ...base, anchor: { x: -50, y: 300 } })
    assertInside({ ...base, anchor: { x: 900, y: -40 }, side: "bottom" })
  })

  it("takes the roomier side when neither fits, then clamps", () => {
    const narrow = { ...base, boundary: { left: 0, top: 0, width: 200, height: 200 } }
    const placed = assertInside({ ...narrow, anchor: { x: 130, y: 100 } })
    assert.equal(placed.side, "left")
  })

  it("pins a card larger than the boundary to its start", () => {
    const placed = placeChartTooltip({
      ...base,
      size: { width: 600, height: 400 },
    })
    assert.equal(placed.x, 8)
    assert.equal(placed.y, 8)
  })

  it("honours a boundary that is not at the origin", () => {
    assertInside({
      ...base,
      boundary: { left: 300, top: 500, width: 260, height: 140 },
      anchor: { x: 550, y: 630 },
    })
  })
})

describe("intersectChartRects", () => {
  it("returns the overlap", () => {
    assert.deepEqual(
      intersectChartRects(
        { left: 0, top: 0, width: 100, height: 100 },
        { left: 50, top: -20, width: 100, height: 60 },
      ),
      { left: 50, top: 0, width: 50, height: 40 },
    )
  })

  it("is empty when the rectangles do not meet", () => {
    assert.deepEqual(
      intersectChartRects(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 20, top: 20, width: 10, height: 10 },
      ),
      { left: 0, top: 0, width: 0, height: 0 },
    )
  })
})
