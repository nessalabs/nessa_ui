/** @responsibility Verifies the workflow canvas coordinate math: transforms round-trip, zoom anchors hold, clamping respects bounds, and edge paths leave nodes perpendicular to their sides. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  canvasPointToScreenPoint,
  clampPositionToBounds,
  clampViewportToBounds,
  edgeMidpoint,
  edgePath,
  nearestNodeSide,
  nodeAnchorPoint,
  preferredEdgeSides,
  screenPointToCanvasPoint,
  zoomViewportAtPoint,
} from "./workflow-canvas-math"

function makeGeometry(overrides: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...overrides }
}

function base() {
  return { x: 100, y: 200, width: 240, height: 120 }
}

describe("coordinate transforms", () => {
  test("screen and canvas conversions round-trip", () => {
    const viewport = { x: 40, y: -30, zoom: 1.5 }
    const point = { x: 123, y: -45 }
    const roundTripped = canvasPointToScreenPoint(
      screenPointToCanvasPoint(point, viewport),
      viewport,
    )

    assert.ok(Math.abs(roundTripped.x - point.x) < 1e-9)
    assert.ok(Math.abs(roundTripped.y - point.y) < 1e-9)
  })

  test("identity viewport keeps points unchanged", () => {
    const viewport = { x: 0, y: 0, zoom: 1 }

    assert.deepEqual(screenPointToCanvasPoint({ x: 7, y: 9 }, viewport), {
      x: 7,
      y: 9,
    })
  })
})

describe("zoomViewportAtPoint", () => {
  test("keeps the canvas point under the anchor stationary", () => {
    const viewport = { x: 20, y: 10, zoom: 1 }
    const anchor = { x: 300, y: 150 }
    const before = screenPointToCanvasPoint(anchor, viewport)
    const next = zoomViewportAtPoint(viewport, anchor, 2, 0.25, 4)
    const after = screenPointToCanvasPoint(anchor, next)

    assert.equal(next.zoom, 2)
    assert.ok(Math.abs(after.x - before.x) < 1e-9)
    assert.ok(Math.abs(after.y - before.y) < 1e-9)
  })

  test("clamps the requested zoom to the allowed range", () => {
    const viewport = { x: 0, y: 0, zoom: 1 }

    assert.equal(
      zoomViewportAtPoint(viewport, { x: 0, y: 0 }, 10, 0.25, 2).zoom,
      2,
    )
    assert.equal(
      zoomViewportAtPoint(viewport, { x: 0, y: 0 }, 0.01, 0.25, 2).zoom,
      0.25,
    )
  })
})

describe("clampViewportToBounds", () => {
  const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000 }
  const size = { width: 800, height: 600 }

  test("passes an unbounded canvas through untouched", () => {
    const viewport = { x: -9999, y: 9999, zoom: 0.5 }

    assert.deepEqual(clampViewportToBounds(viewport, null, size), viewport)
  })

  test("stops panning past the top-left of the bounds", () => {
    const clamped = clampViewportToBounds({ x: 500, y: 400, zoom: 1 }, bounds, size)

    assert.equal(clamped.x, 0)
    assert.equal(clamped.y, 0)
  })

  test("stops panning past the bottom-right of the bounds", () => {
    const clamped = clampViewportToBounds(
      { x: -5000, y: -5000, zoom: 1 },
      bounds,
      size,
    )

    assert.equal(clamped.x, size.width - bounds.maxX)
    assert.equal(clamped.y, size.height - bounds.maxY)
  })

  test("centers an axis when zoomed-out bounds are narrower than the window", () => {
    const clamped = clampViewportToBounds(
      { x: 0, y: 0, zoom: 0.25 },
      bounds,
      size,
    )

    // At zoom 0.25 the 2000-wide bounds span 500px inside an 800px window,
    // so the content centers with 150px of margin on each side.
    assert.equal(clamped.x, 150)
  })
})

describe("clampPositionToBounds", () => {
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 500 }

  test("keeps a node's full box inside the bounds", () => {
    const clamped = clampPositionToBounds(
      { x: 990, y: -20 },
      { width: 200, height: 100 },
      bounds,
    )

    assert.deepEqual(clamped, { x: 800, y: 0 })
  })

  test("prefers the minimum edge when the node is larger than the bounds", () => {
    const clamped = clampPositionToBounds(
      { x: 400, y: 400 },
      { width: 2000, height: 2000 },
      bounds,
    )

    assert.deepEqual(clamped, { x: 0, y: 0 })
  })
})

describe("node anchors and sides", () => {
  test("anchors sit at side midpoints", () => {
    const geometry = makeGeometry()

    assert.deepEqual(nodeAnchorPoint(geometry, "top"), { x: 220, y: 200 })
    assert.deepEqual(nodeAnchorPoint(geometry, "bottom"), { x: 220, y: 320 })
    assert.deepEqual(nodeAnchorPoint(geometry, "left"), { x: 100, y: 260 })
    assert.deepEqual(nodeAnchorPoint(geometry, "right"), { x: 340, y: 260 })
  })

  test("nearestNodeSide picks the dominant direction from the center", () => {
    const geometry = makeGeometry()

    assert.equal(nearestNodeSide(geometry, { x: 500, y: 260 }), "right")
    assert.equal(nearestNodeSide(geometry, { x: -100, y: 260 }), "left")
    assert.equal(nearestNodeSide(geometry, { x: 220, y: 0 }), "top")
    assert.equal(nearestNodeSide(geometry, { x: 220, y: 900 }), "bottom")
  })
})

describe("preferredEdgeSides", () => {
  test("connects horizontally when the target sits beside the source", () => {
    const source = makeGeometry()
    const rightward = makeGeometry({ x: 600 })
    const leftward = makeGeometry({ x: -600 })

    assert.deepEqual(preferredEdgeSides(source, rightward), {
      sourceSide: "right",
      targetSide: "left",
    })
    assert.deepEqual(preferredEdgeSides(source, leftward), {
      sourceSide: "left",
      targetSide: "right",
    })
  })

  test("connects vertically when the target sits above or below", () => {
    const source = makeGeometry()
    const below = makeGeometry({ y: 900 })
    const above = makeGeometry({ y: -900 })

    assert.deepEqual(preferredEdgeSides(source, below), {
      sourceSide: "bottom",
      targetSide: "top",
    })
    assert.deepEqual(preferredEdgeSides(source, above), {
      sourceSide: "top",
      targetSide: "bottom",
    })
  })

  test("routes around the axis the boxes overlap on", () => {
    // 240x120 boxes at (100,200) and (200,420): the centres are 220 apart
    // vertically and only 100 apart horizontally, but the boxes still
    // overlap horizontally — facing left/right sides there would point
    // away from each other and double the edge back over both bodies.
    const source = makeGeometry()
    const below = makeGeometry({ x: 200, y: 420 })

    assert.deepEqual(preferredEdgeSides(source, below), {
      sourceSide: "bottom",
      targetSide: "top",
    })

    // The mirror case: boxes clearing horizontally but overlapping
    // vertically connect side to side even when the centres are further
    // apart vertically than horizontally.
    const beside = makeGeometry({ x: 460, y: 260 })

    assert.deepEqual(preferredEdgeSides(source, beside), {
      sourceSide: "right",
      targetSide: "left",
    })
  })

  test("falls back to the dominant centre delta when boxes overlap on both axes", () => {
    const source = makeGeometry()
    const nudged = makeGeometry({ x: 160, y: 220 })

    assert.deepEqual(preferredEdgeSides(source, nudged), {
      sourceSide: "right",
      targetSide: "left",
    })
  })
})

describe("edgeMidpoint", () => {
  test("sits halfway along a straight horizontal edge", () => {
    const midpoint = edgeMidpoint(
      { x: 0, y: 10 },
      "right",
      { x: 100, y: 10 },
      "left",
    )

    assert.deepEqual(midpoint, { x: 50, y: 10 })
  })
})

describe("edgePath", () => {
  test("starts at the source and ends at the target", () => {
    const path = edgePath({ x: 10, y: 20 }, "right", { x: 300, y: 40 }, "left")

    assert.ok(path.startsWith("M 10,20 C "))
    assert.ok(path.endsWith(" 300,40"))
  })

  test("control points reach outward along each side's normal", () => {
    const path = edgePath({ x: 0, y: 0 }, "right", { x: 100, y: 0 }, "left")
    // Anchors 100 apart produce a 50-unit reach along each horizontal
    // normal: outward right from the source, outward left from the target.
    assert.equal(path, "M 0,0 C 50,0 50,0 100,0")
  })

  test("keeps a minimum reach for very short edges", () => {
    const path = edgePath({ x: 0, y: 0 }, "bottom", { x: 0, y: 10 }, "top")

    assert.equal(path, "M 0,0 C 0,24 0,-14 0,10")
  })
})
