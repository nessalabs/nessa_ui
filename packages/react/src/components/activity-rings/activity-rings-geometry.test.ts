import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  activityRingCapPoint,
  activityRingTrackPath,
  computeActivityRingsLayout,
  type ActivityRingsLayout,
  type ActivityRingsLayoutOptions,
} from "./activity-rings-geometry"

const TAU = Math.PI * 2

const BASE: ActivityRingsLayoutOptions = {
  rings: [
    { id: "move", value: 450, goal: 800 },
    { id: "exercise", value: 19, goal: 30 },
    { id: "stand", value: 4, goal: 12 },
  ],
  width: 200,
  height: 200,
  arrangement: "concentric",
  thickness: 16,
  ringGap: 4,
  segmentGap: 6,
  startAngle: 0,
}

function ringById(layout: ActivityRingsLayout, id: string) {
  const ring = layout.rings.find((candidate) => candidate.id === id)
  assert.ok(ring, `ring ${id} missing from layout`)
  return ring
}

describe("computeActivityRingsLayout, concentric", () => {
  it("nests the tracks outside-in in input order", () => {
    const layout = computeActivityRingsLayout(BASE)
    assert.equal(layout.rings.length, 3)
    assert.equal(layout.cx, 100)
    assert.equal(layout.cy, 100)
    // Outer centreline sits half a band in from the box edge.
    assert.equal(ringById(layout, "move").radius, 92)
    assert.equal(ringById(layout, "exercise").radius, 92 - 20)
    assert.equal(ringById(layout, "stand").radius, 92 - 40)
    assert.equal(layout.outerRadius, 92)
    assert.equal(layout.innerRadius, 52)
    assert.equal(layout.centerRadius, 44)
  })

  it("gives every concentric ring the whole circle", () => {
    const layout = computeActivityRingsLayout(BASE)
    for (const ring of layout.rings) {
      assert.equal(ring.trackEnd - ring.trackStart, TAU)
    }
  })

  it("reads progress as a fraction of the goal", () => {
    const layout = computeActivityRingsLayout(BASE)
    const move = ringById(layout, "move")
    assert.equal(move.progress, 450 / 800)
    assert.equal(move.laps, 0)
    assert.ok(Math.abs(move.fill - 0.5625) < 1e-12)
    assert.ok(Math.abs(move.capAngle - TAU * 0.5625) < 1e-12)
  })

  it("draws a met goal as a full arc rather than an empty one", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      rings: [{ id: "move", value: 800, goal: 800 }],
    })
    const move = ringById(layout, "move")
    assert.equal(move.laps, 0)
    assert.equal(move.fill, 1)
  })

  it("laps a beaten goal instead of clamping it", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      rings: [
        { id: "half", value: 1200, goal: 800 },
        { id: "double", value: 1600, goal: 800 },
      ],
    })
    assert.deepEqual(
      { laps: ringById(layout, "half").laps, fill: ringById(layout, "half").fill },
      { laps: 1, fill: 0.5 },
    )
    assert.deepEqual(
      {
        laps: ringById(layout, "double").laps,
        fill: ringById(layout, "double").fill,
      },
      { laps: 1, fill: 1 },
    )
  })

  it("drops a ring that has run out of room", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      width: 90,
      height: 90,
    })
    assert.equal(layout.rings.length, 2)
    assert.deepEqual(
      layout.issues.map((issue) => [issue.kind, issue.ringId]),
      [["no-room", "stand"]],
    )
  })

  it("starts the tracks where startAngle says", () => {
    const layout = computeActivityRingsLayout({ ...BASE, startAngle: 90 })
    const move = ringById(layout, "move")
    assert.ok(Math.abs(move.trackStart - Math.PI / 2) < 1e-12)
  })
})

describe("computeActivityRingsLayout, segmented", () => {
  const segmented: ActivityRingsLayoutOptions = {
    ...BASE,
    arrangement: "segmented",
    rings: [
      { id: "duration", value: 42, goal: 50 },
      { id: "bedtime", value: 26, goal: 30 },
      { id: "interruptions", value: 18, goal: 20 },
    ],
  }

  const GAP = (6 * Math.PI) / 180
  const AVAILABLE = TAU - GAP * 3

  it("shares one track and splits the sweep by goal", () => {
    const layout = computeActivityRingsLayout(segmented)
    const inset = 16 / 2 / layout.outerRadius
    const spanOf = (id: string) => {
      const ring = ringById(layout, id)
      return ring.trackEnd - ring.trackStart + inset * 2
    }
    for (const ring of layout.rings) assert.equal(ring.radius, layout.outerRadius)
    assert.ok(Math.abs(spanOf("duration") - AVAILABLE * (50 / 100)) < 1e-12)
    assert.ok(Math.abs(spanOf("bedtime") - AVAILABLE * (30 / 100)) < 1e-12)
    assert.ok(Math.abs(spanOf("interruptions") - AVAILABLE * (20 / 100)) < 1e-12)
    const claimed = layout.rings.reduce((sum, ring) => sum + spanOf(ring.id), 0)
    assert.ok(Math.abs(claimed + GAP * 3 - TAU) < 1e-12)
  })

  it("insets each segment by the round cap's overhang so the gaps survive", () => {
    const layout = computeActivityRingsLayout(segmented)
    const inset = 16 / 2 / layout.outerRadius
    const duration = ringById(layout, "duration")
    const bedtime = ringById(layout, "bedtime")
    assert.ok(Math.abs(duration.trackStart - inset) < 1e-12)
    // Start to start is the segment's whole share plus one gap, whatever the
    // caps take off each drawn end.
    assert.ok(
      Math.abs(
        bedtime.trackStart - duration.trackStart - (AVAILABLE * 0.5 + GAP),
      ) < 1e-12,
    )
    // The visible gap keeps its full width once both caps are added back.
    assert.ok(
      Math.abs(bedtime.trackStart - duration.trackEnd - (GAP + inset * 2)) <
        1e-12,
    )
  })

  it("bounds a segment by its own span instead of lapping", () => {
    const layout = computeActivityRingsLayout({
      ...segmented,
      rings: [{ id: "duration", value: 120, goal: 50 }],
    })
    const duration = ringById(layout, "duration")
    assert.equal(duration.progress, 2.4)
    assert.equal(duration.laps, 0)
    assert.equal(duration.fill, 1)
    assert.equal(duration.capAngle, duration.trackEnd)
  })

  it("keeps a segment too narrow for its own caps as a point rather than dropping it", () => {
    const layout = computeActivityRingsLayout({
      ...segmented,
      rings: [
        { id: "sliver", value: 1, goal: 1 },
        { id: "rest", value: 50, goal: 99 },
      ],
    })
    const sliver = ringById(layout, "sliver")
    // Too narrow to carry a cap at each end, so it collapses onto the middle
    // of its own share instead of insetting itself out of existence.
    assert.equal(sliver.trackStart, sliver.trackEnd)
    assert.equal(sliver.capAngle, sliver.trackStart)
    // A point still draws: an empty path would take the metric off the ring.
    assert.notEqual(
      activityRingTrackPath(
        layout.cx,
        layout.cy,
        sliver.radius,
        sliver.trackStart,
        sliver.trackEnd,
      ),
      "",
    )
    // The wide neighbour is unaffected and still carries two cap insets.
    const rest = ringById(layout, "rest")
    assert.ok(rest.trackEnd - rest.trackStart > 0)
  })

  it("collapses gaps that would outgrow the circle rather than drawing backwards", () => {
    const layout = computeActivityRingsLayout({
      ...segmented,
      segmentGap: 240,
    })
    for (const ring of layout.rings) {
      assert.equal(ring.trackEnd - ring.trackStart, 0)
    }
  })
})

describe("computeActivityRingsLayout, tolerated data problems", () => {
  it("keeps the first of a duplicated id and says so", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      rings: [
        { id: "move", value: 450, goal: 800 },
        { id: "move", value: 10, goal: 20 },
      ],
    })
    assert.equal(layout.rings.length, 1)
    assert.equal(ringById(layout, "move").value, 450)
    assert.equal(layout.issues[0]?.kind, "duplicate-ring")
  })

  it("drops a ring with no usable goal", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      rings: [
        { id: "move", value: 1, goal: 0 },
        { id: "stand", value: 1, goal: Number.NaN },
      ],
    })
    assert.equal(layout.rings.length, 0)
    assert.deepEqual(
      layout.issues.map((issue) => issue.kind),
      ["invalid-goal", "invalid-goal", "empty"],
    )
  })

  it("reads a negative value as zero and drops a non-finite one", () => {
    const layout = computeActivityRingsLayout({
      ...BASE,
      rings: [
        { id: "move", value: -50, goal: 800 },
        { id: "stand", value: Number.POSITIVE_INFINITY, goal: 12 },
      ],
    })
    assert.equal(layout.rings.length, 1)
    assert.equal(ringById(layout, "move").value, 0)
    assert.equal(ringById(layout, "move").fill, 0)
    assert.deepEqual(
      layout.issues.map((issue) => issue.kind).sort(),
      ["invalid-value", "invalid-value"],
    )
  })

  it("reports nothing when the data is clean", () => {
    assert.deepEqual(computeActivityRingsLayout(BASE).issues, [])
  })
})

describe("activityRingTrackPath", () => {
  it("draws a full turn as two closed half arcs", () => {
    const path = activityRingTrackPath(100, 100, 90, 0, TAU)
    assert.equal(path.match(/A/g)?.length, 2)
    assert.ok(path.endsWith("Z"))
    assert.ok(path.startsWith("M100,10"))
  })

  it("flags the long way round past a half turn", () => {
    const short = activityRingTrackPath(0, 0, 10, 0, Math.PI / 2)
    const long = activityRingTrackPath(0, 0, 10, 0, Math.PI * 1.5)
    assert.match(short, /A10,10 0 0 1/)
    assert.match(long, /A10,10 0 1 1/)
  })

  it("draws a zero-length subpath for an empty range, so a round cap marks it", () => {
    assert.equal(activityRingTrackPath(100, 100, 90, 0, 0), "M100,10L100,10")
  })

  it("draws nothing for an impossible track", () => {
    assert.equal(activityRingTrackPath(0, 0, 0, 0, Math.PI), "")
    assert.equal(activityRingTrackPath(0, 0, 10, 0, Number.NaN), "")
    assert.equal(activityRingTrackPath(0, 0, 10, 0, -1), "")
  })
})

describe("activityRingCapPoint", () => {
  it("puts a zero-progress cap at the top of the track", () => {
    const point = activityRingCapPoint({ capAngle: 0, radius: 90 }, 100, 100)
    assert.deepEqual(point, { x: 100, y: 10 })
  })

  it("follows the arc clockwise", () => {
    const point = activityRingCapPoint(
      { capAngle: Math.PI / 2, radius: 90 },
      100,
      100,
    )
    assert.ok(Math.abs(point.x - 190) < 1e-9)
    assert.ok(Math.abs(point.y - 100) < 1e-9)
  })
})
