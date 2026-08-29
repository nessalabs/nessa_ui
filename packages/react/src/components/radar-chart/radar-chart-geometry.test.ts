import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeRadarChartLayout,
  radarChartOutlinePath,
  radarChartRingPath,
  type RadarChartLayoutOptions,
} from "./radar-chart-geometry"

const BASE: RadarChartLayoutOptions = {
  axes: [{ id: "speed" }, { id: "power" }, { id: "range" }, { id: "cost" }],
  series: [
    { id: "alpha", values: { speed: 100, power: 50, range: 25, cost: 0 } },
    { id: "beta", values: { speed: 50, power: 100, range: 50, cost: 50 } },
  ],
  width: 400,
  height: 400,
  rings: 4,
  paddingX: 40,
  paddingY: 40,
}

function axisById(
  layout: ReturnType<typeof computeRadarChartLayout>,
  id: string,
) {
  const axis = layout.axes.find((candidate) => candidate.id === id)
  assert.ok(axis, `axis ${id} missing from layout`)
  return axis
}

function pointOn(
  layout: ReturnType<typeof computeRadarChartLayout>,
  seriesId: string,
  axisId: string,
) {
  const series = layout.series.find((candidate) => candidate.id === seriesId)
  assert.ok(series, `series ${seriesId} missing from layout`)
  const point = series.points.find((candidate) => candidate.axisId === axisId)
  assert.ok(point, `point ${seriesId}/${axisId} missing from layout`)
  return point
}

describe("computeRadarChartLayout", () => {
  it("centres the plot, sizes the radius to the padded box, and starts straight up", () => {
    const layout = computeRadarChartLayout(BASE)
    assert.equal(layout.cx, 200)
    assert.equal(layout.cy, 200)
    assert.equal(layout.radius, 160)
    const speed = axisById(layout, "speed")
    assert.equal(speed.angle, 0)
    assert.ok(Math.abs(speed.x - 200) < 1e-9)
    assert.equal(speed.y, 40)
    assert.equal(speed.anchor, "middle")
  })

  it("takes the radius from the short side of an oblong box", () => {
    const layout = computeRadarChartLayout({ ...BASE, width: 600, height: 300 })
    assert.equal(layout.radius, 110)
    assert.equal(layout.cx, 300)
  })

  it("steps axes clockwise by default and anticlockwise on request", () => {
    const clockwise = computeRadarChartLayout(BASE)
    assert.ok(axisById(clockwise, "power").x > clockwise.cx)
    const anticlockwise = computeRadarChartLayout({ ...BASE, clockwise: false })
    assert.ok(axisById(anticlockwise, "power").x < anticlockwise.cx)
  })

  it("anchors labels away from the plot on each side and centres the poles", () => {
    const layout = computeRadarChartLayout(BASE)
    assert.equal(axisById(layout, "speed").anchor, "middle")
    assert.equal(axisById(layout, "power").anchor, "start")
    assert.equal(axisById(layout, "range").anchor, "middle")
    assert.equal(axisById(layout, "cost").anchor, "end")
  })

  it("shared scale measures every axis against the largest reading anywhere", () => {
    const layout = computeRadarChartLayout(BASE)
    for (const axis of layout.axes) assert.equal(axis.max, 100)
    assert.equal(pointOn(layout, "alpha", "power").ratio, 0.5)
    assert.equal(pointOn(layout, "beta", "range").ratio, 0.5)
  })

  it("axis scale normalises each spoke independently", () => {
    const layout = computeRadarChartLayout({ ...BASE, scale: "axis" })
    assert.equal(axisById(layout, "range").max, 50)
    assert.equal(axisById(layout, "cost").max, 50)
    assert.equal(pointOn(layout, "beta", "range").ratio, 1)
    assert.equal(pointOn(layout, "alpha", "range").ratio, 0.5)
  })

  it("an explicit axis max overrides both scale modes and clamps overshoot", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      axes: [{ id: "speed", max: 50 }, { id: "power" }, { id: "range" }, { id: "cost" }],
    })
    assert.equal(axisById(layout, "speed").max, 50)
    assert.equal(pointOn(layout, "alpha", "speed").ratio, 1)
  })

  it("ignores and reports a non-finite axis maximum instead of poisoning the shared scale", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      axes: [{ id: "speed", max: Number.POSITIVE_INFINITY }, { id: "power" }, { id: "range" }, { id: "cost" }],
      series: [{ id: "alpha", values: { speed: 5, power: 8, range: 9, cost: 1 } }],
    })
    // The shared maximum must come from the readings, not from the bad axis.
    for (const axis of layout.axes) assert.equal(axis.max, 9)
    assert.ok(pointOn(layout, "alpha", "range").ratio > 0)
    assert.equal(
      layout.issues.filter((issue) => issue.kind === "invalid-value").length,
      1,
    )
  })

  it("ignores a NaN axis maximum rather than pegging every ratio", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      axes: [{ id: "speed", max: Number.NaN }, { id: "power" }, { id: "range" }, { id: "cost" }],
      series: [{ id: "alpha", values: { speed: 5, power: 8, range: 9, cost: 1 } }],
    })
    assert.equal(axisById(layout, "speed").max, 9)
    assert.ok(Math.abs(pointOn(layout, "alpha", "speed").ratio - 5 / 9) < 1e-12)
  })

  it("an axis with no positive reading falls back to a maximum of one", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      scale: "axis",
      series: [{ id: "alpha", values: { speed: 4, power: 0, range: 0, cost: 0 } }],
    })
    assert.equal(axisById(layout, "power").max, 1)
    assert.equal(pointOn(layout, "alpha", "power").ratio, 0)
  })

  it("reports a missing reading and draws it at the centre", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      series: [{ id: "alpha", values: { speed: 10, power: 5 } }],
    })
    assert.deepEqual(
      layout.issues.filter((issue) => issue.kind === "missing-value").map((issue) => issue.axisId),
      ["range", "cost"],
    )
    assert.equal(pointOn(layout, "alpha", "range").value, 0)
    assert.equal(pointOn(layout, "alpha", "range").x, layout.cx)
    assert.equal(pointOn(layout, "alpha", "range").y, layout.cy)
  })

  it("reports unknown axes, negative readings, and duplicate ids without dropping the frame", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      axes: [...BASE.axes, { id: "speed" }],
      series: [
        { id: "alpha", values: { speed: 10, power: 5, range: 1, cost: 1, weight: 9 } },
        { id: "alpha", values: { speed: 1, power: 1, range: 1, cost: 1 } },
        { id: "gamma", values: { speed: -3, power: 1, range: 1, cost: 1 } },
      ],
    })
    assert.equal(layout.axes.length, 4)
    assert.equal(layout.series.length, 2)
    const kinds = layout.issues.map((issue) => issue.kind)
    assert.ok(kinds.includes("duplicate-axis"))
    assert.ok(kinds.includes("duplicate-series"))
    assert.ok(kinds.includes("unknown-axis"))
    assert.ok(kinds.includes("invalid-value"))
    // The first "alpha" is the one that was kept.
    assert.equal(pointOn(layout, "alpha", "speed").value, 10)
    assert.equal(pointOn(layout, "gamma", "speed").value, 0)
  })

  it("flags fewer than three axes as degenerate but still places them", () => {
    const layout = computeRadarChartLayout({
      ...BASE,
      axes: [{ id: "speed" }, { id: "power" }],
      series: [{ id: "alpha", values: { speed: 1, power: 1 } }],
    })
    assert.equal(layout.axes.length, 2)
    assert.equal(layout.issues.filter((issue) => issue.kind === "degenerate").length, 1)
  })

  it("stacks rings outward with the last on the outer edge", () => {
    const layout = computeRadarChartLayout({ ...BASE, rings: 4 })
    assert.deepEqual(layout.rings, [40, 80, 120, 160])
    assert.deepEqual(computeRadarChartLayout({ ...BASE, rings: 0 }).rings, [160])
  })

  it("reports coverage as the mean ratio across the axes", () => {
    const layout = computeRadarChartLayout(BASE)
    const alpha = layout.series.find((series) => series.id === "alpha")!
    assert.ok(Math.abs(alpha.coverage - (1 + 0.5 + 0.25 + 0) / 4) < 1e-12)
  })

  it("survives a box too small to hold the padding", () => {
    const layout = computeRadarChartLayout({ ...BASE, width: 40, height: 40 })
    assert.equal(layout.radius, 0)
    assert.deepEqual(layout.rings, [0, 0, 0, 0])
  })
})

describe("radarChartOutlinePath", () => {
  const square = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]

  it("draws a closed polygon at zero curve", () => {
    assert.equal(radarChartOutlinePath(square, 0), "M0,-1L1,0L0,1L-1,0Z")
  })

  it("relaxes into a closed spline above zero curve", () => {
    const path = radarChartOutlinePath(square, 1)
    assert.ok(path.startsWith("M0,-1C"))
    assert.equal(path.match(/C/g)?.length, 4)
    assert.ok(path.endsWith("Z"))
  })

  it("keeps straight segments when there are too few points to curve", () => {
    assert.equal(radarChartOutlinePath(square.slice(0, 2), 1), "M0,-1L1,0Z")
    assert.equal(radarChartOutlinePath([], 1), "")
  })
})

describe("radarChartRingPath", () => {
  it("follows the spokes for a polygon grid", () => {
    const layout = computeRadarChartLayout(BASE)
    const path = radarChartRingPath(
      layout.cx,
      layout.cy,
      layout.radius,
      layout.axes.map((axis) => axis.angle),
      "polygon",
    )
    assert.equal(path.match(/L/g)?.length, 3)
    assert.ok(path.endsWith("Z"))
  })

  it("takes the outlines' curve so the grid shares their silhouette", () => {
    const layout = computeRadarChartLayout(BASE)
    const angles = layout.axes.map((axis) => axis.angle)
    const hard = radarChartRingPath(layout.cx, layout.cy, layout.radius, angles, "polygon", 0)
    const soft = radarChartRingPath(layout.cx, layout.cy, layout.radius, angles, "polygon", 0.25)
    assert.ok(hard.includes("L") && !hard.includes("C"))
    assert.ok(soft.includes("C") && !soft.includes("L"))
  })

  it("draws arcs for a circular grid and nothing at zero radius", () => {
    assert.ok(radarChartRingPath(0, 0, 10, [], "circle").includes("A10,10"))
    assert.equal(radarChartRingPath(0, 0, 0, [], "polygon"), "")
  })
})
