import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computePieChartLayout,
  pieChartCentroid,
  pieChartLeaderPath,
  pieChartSlicePath,
  type PieChartLayoutOptions,
} from "./pie-chart-geometry"

const TAU = Math.PI * 2

const BASE: PieChartLayoutOptions = {
  slices: [
    { id: "chrome", value: 50 },
    { id: "safari", value: 25 },
    { id: "firefox", value: 25 },
  ],
  width: 400,
  height: 400,
  paddingX: 40,
  paddingY: 40,
  innerRadius: 0,
  padAngle: 0,
  cornerRadius: 0,
  startAngle: 0,
  endAngle: 360,
}

function sliceById(
  layout: ReturnType<typeof computePieChartLayout>,
  id: string,
) {
  const slice = layout.slices.find((candidate) => candidate.id === id)
  assert.ok(slice, `slice ${id} missing from layout`)
  return slice
}

describe("computePieChartLayout", () => {
  it("centres the plot and sizes the radius to the padded short side", () => {
    const layout = computePieChartLayout(BASE)
    assert.equal(layout.cx, 200)
    assert.equal(layout.cy, 200)
    assert.equal(layout.outerRadius, 160)
    assert.equal(layout.innerRadius, 0)
    assert.equal(computePieChartLayout({ ...BASE, width: 600 }).outerRadius, 160)
  })

  it("divides the full sweep by share, starting straight up", () => {
    const layout = computePieChartLayout(BASE)
    assert.equal(layout.total, 100)
    assert.equal(sliceById(layout, "chrome").share, 0.5)
    assert.equal(sliceById(layout, "chrome").startAngle, 0)
    assert.ok(Math.abs(sliceById(layout, "chrome").endAngle - TAU / 2) < 1e-12)
    assert.ok(Math.abs(sliceById(layout, "firefox").endAngle - TAU) < 1e-12)
  })

  it("fits and centres a narrowed sweep instead of stranding it in half the box", () => {
    // A half turn from nine o'clock to three occupies a 2:1 box, so it takes
    // the full width and sits centred in the height.
    const layout = computePieChartLayout({
      ...BASE,
      paddingX: 0, paddingY: 0,
      startAngle: -90,
      endAngle: 90,
    })
    assert.equal(layout.outerRadius, 200)
    assert.equal(layout.cx, 200)
    assert.equal(layout.cy, 300)
  })

  it("drops a gauge's readout low in the bowl, not at the strike centre or the box middle", () => {
    const layout = computePieChartLayout({
      ...BASE,
      paddingX: 0,
      paddingY: 0,
      startAngle: -90,
      endAngle: 90,
    })
    // Struck from (200, 300) with radius 200; the drawn box middle is 100px
    // above that, and the readout sits a fraction of the way there.
    assert.equal(layout.cy, 300)
    assert.equal(layout.centerX, 200)
    assert.ok(layout.centerY < layout.cy, "readout must sit inside the bowl")
    assert.ok(
      layout.centerY > layout.cy - 100,
      "readout must stay below the drawn box middle",
    )
    assert.equal(layout.centerY, 300 - 0.5 * 200 * 0.36)
  })

  it("leaves a full turn's readout on the centre it is struck from", () => {
    const layout = computePieChartLayout({ ...BASE, paddingX: 0, paddingY: 0 })
    assert.equal(layout.centerX, layout.cx)
    assert.equal(layout.centerY, layout.cy)
  })

  it("keeps a full turn centred on the box, as before", () => {
    const layout = computePieChartLayout({ ...BASE, paddingX: 0, paddingY: 0 })
    assert.equal(layout.outerRadius, 200)
    assert.equal(layout.cx, 200)
    assert.equal(layout.cy, 200)
  })

  it("counts the hole when fitting a sweep, since an annulus never reaches the centre", () => {
    // A quarter turn centred on three o'clock. Solid, the wedge closes on the
    // centre and so spans a full radius horizontally; hollowed, that near
    // corner is cut away and the arc can be drawn larger in the same width.
    const sweep = { paddingX: 0, paddingY: 0, startAngle: 45, endAngle: 135, width: 200, height: 800 }
    const solid = computePieChartLayout({ ...BASE, ...sweep })
    const hollow = computePieChartLayout({ ...BASE, ...sweep, innerRadius: 0.5 })
    assert.equal(solid.outerRadius, 200)
    assert.ok(hollow.outerRadius > solid.outerRadius)
  })

  it("honours a partial sweep so a half circle reads as a gauge", () => {
    const layout = computePieChartLayout({
      ...BASE,
      startAngle: -90,
      endAngle: 90,
    })
    assert.ok(Math.abs(sliceById(layout, "chrome").startAngle + Math.PI / 2) < 1e-12)
    assert.ok(Math.abs(sliceById(layout, "firefox").endAngle - Math.PI / 2) < 1e-12)
  })

  it("takes the pad out of both ends of every wedge", () => {
    const layout = computePieChartLayout({ ...BASE, padAngle: 4 })
    const pad = (4 * Math.PI) / 180
    const chrome = sliceById(layout, "chrome")
    assert.ok(Math.abs(chrome.startAngle - pad / 2) < 1e-12)
    assert.ok(Math.abs(chrome.endAngle - (TAU / 2 - pad / 2)) < 1e-12)
    // The unpadded midpoint still anchors the label.
    assert.ok(Math.abs(chrome.centroidAngle - TAU / 4) < 1e-12)
  })

  it("takes the pad out of a reversed sweep rather than growing its wedges", () => {
    const forward = computePieChartLayout({
      ...BASE,
      slices: [{ id: "a", value: 1 }, { id: "b", value: 1 }],
      padAngle: 10,
      startAngle: -90,
      endAngle: 90,
    })
    const reversed = computePieChartLayout({
      ...BASE,
      slices: [{ id: "a", value: 1 }, { id: "b", value: 1 }],
      padAngle: 10,
      startAngle: 90,
      endAngle: -90,
    })
    const width = (layout: ReturnType<typeof computePieChartLayout>, id: string) =>
      Math.abs(sliceById(layout, id).endAngle - sliceById(layout, id).startAngle)
    // Each wedge is its 90-degree share less the 10-degree gap, whichever way
    // the sweep runs — never its share PLUS the gap.
    for (const layout of [forward, reversed]) {
      assert.ok(Math.abs(width(layout, "a") - (Math.PI / 2 - (10 * Math.PI) / 180)) < 1e-12)
      assert.ok(Math.abs(width(layout, "b") - (Math.PI / 2 - (10 * Math.PI) / 180)) < 1e-12)
    }
    // And they must not overlap: b begins beyond where a ended.
    const a = sliceById(reversed, "a")
    const b = sliceById(reversed, "b")
    assert.ok(b.startAngle < a.endAngle)
  })

  it("collapses a wedge narrower than the pad instead of inverting it", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [{ id: "big", value: 999 }, { id: "sliver", value: 1 }],
      padAngle: 30,
    })
    const sliver = sliceById(layout, "sliver")
    assert.ok(sliver.endAngle >= sliver.startAngle)
    assert.equal(pieChartSlicePath(sliver, 0, 0, 100, 0), "")
  })

  it("scales the hole to the outer radius and clamps it there", () => {
    assert.equal(computePieChartLayout({ ...BASE, innerRadius: 0.5 }).innerRadius, 80)
    assert.equal(computePieChartLayout({ ...BASE, innerRadius: 4 }).innerRadius, 160)
    assert.equal(computePieChartLayout({ ...BASE, innerRadius: -1 }).innerRadius, 0)
  })

  it("sorts by value in either direction and keeps input order by default", () => {
    const input = computePieChartLayout(BASE).slices.map((slice) => slice.id)
    assert.deepEqual(input, ["chrome", "safari", "firefox"])
    assert.deepEqual(
      computePieChartLayout({ ...BASE, sort: "ascending" }).slices.map((slice) => slice.id),
      ["safari", "firefox", "chrome"],
    )
    assert.deepEqual(
      computePieChartLayout({ ...BASE, sort: "descending" }).slices.map((slice) => slice.id),
      ["chrome", "safari", "firefox"],
    )
  })

  it("keeps the original input index through sorting and rollup", () => {
    const layout = computePieChartLayout({ ...BASE, sort: "ascending" })
    assert.equal(sliceById(layout, "chrome").index, 0)
    assert.equal(sliceById(layout, "safari").index, 1)
  })

  it("rolls slices under the threshold into one trailing bucket", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "chrome", value: 60 },
        { id: "safari", value: 30 },
        { id: "firefox", value: 4 },
        { id: "edge", value: 3 },
        { id: "opera", value: 3 },
      ],
      groupThreshold: 0.05,
    })
    assert.deepEqual(layout.slices.map((slice) => slice.id), [
      "chrome",
      "safari",
      "other",
    ])
    const other = sliceById(layout, "other")
    assert.equal(other.value, 10)
    assert.equal(other.index, -1)
    assert.deepEqual(other.members, ["firefox", "edge", "opera"])
    // The bucket still spans its true share of the circle.
    assert.ok(Math.abs(other.share - 0.1) < 1e-12)
  })

  it("leaves a lone small slice alone, because a bucket of one is a rename", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "chrome", value: 60 },
        { id: "safari", value: 39 },
        { id: "opera", value: 1 },
      ],
      groupThreshold: 0.05,
    })
    assert.deepEqual(layout.slices.map((slice) => slice.id), [
      "chrome",
      "safari",
      "opera",
    ])
  })

  it("gives the bucket a free id when the host's data already uses it", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "other", value: 90 },
        { id: "a", value: 1 },
        { id: "b", value: 1 },
      ],
      groupThreshold: 0.05,
    })
    // Two laid-out slices sharing an id would collide React keys and make
    // every id lookup resolve the bucket to the wrong row.
    const ids = layout.slices.map((slice) => slice.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual(ids, ["other", "other-2"])
    assert.equal(
      layout.issues.filter((issue) => issue.kind === "group-id-collision").length,
      1,
    )
  })

  it("does not notch a lone slice against itself", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [{ id: "only", value: 1 }],
      padAngle: 12,
    })
    const only = sliceById(layout, "only")
    assert.ok(Math.abs(only.endAngle - only.startAngle - TAU) < 1e-12)
  })

  it("caps a sweep at one turn so a share cannot wrap over its neighbours", () => {
    const layout = computePieChartLayout({ ...BASE, startAngle: 0, endAngle: 720 })
    const total = layout.slices.reduce(
      (sum, slice) => sum + (slice.endAngle - slice.startAngle),
      0,
    )
    assert.ok(total <= TAU + 1e-9)
  })

  it("keeps the radius and the centre finite when the sweep is degenerate", () => {
    const layout = computePieChartLayout({
      ...BASE,
      startAngle: 90,
      endAngle: 90,
      innerRadius: 1,
    })
    assert.ok(Number.isFinite(layout.outerRadius))
    assert.ok(Number.isFinite(layout.cx) && Number.isFinite(layout.cy))
    assert.ok(Number.isFinite(layout.centerX) && Number.isFinite(layout.centerY))
  })

  it("takes the bucket id from the host", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "chrome", value: 90 },
        { id: "a", value: 1 },
        { id: "b", value: 1 },
      ],
      groupThreshold: 0.05,
      groupId: "everything-else",
    })
    assert.ok(sliceById(layout, "everything-else"))
  })

  it("drops non-positive and non-finite values without folding them into the total", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "chrome", value: 50 },
        { id: "safari", value: 0 },
        { id: "firefox", value: -10 },
        { id: "edge", value: Number.NaN },
        { id: "opera", value: 50 },
      ],
    })
    assert.equal(layout.total, 100)
    assert.deepEqual(layout.slices.map((slice) => slice.id), ["chrome", "opera"])
    assert.equal(
      layout.issues.filter((issue) => issue.kind === "invalid-value").length,
      3,
    )
  })

  it("keeps the first of a duplicated id and reports the rest", () => {
    const layout = computePieChartLayout({
      ...BASE,
      slices: [
        { id: "chrome", value: 50 },
        { id: "chrome", value: 999 },
      ],
    })
    assert.equal(layout.slices.length, 1)
    assert.equal(layout.total, 50)
    assert.equal(layout.issues[0].kind, "duplicate-slice")
  })

  it("reports an all-empty data set instead of drawing nothing silently", () => {
    const layout = computePieChartLayout({ ...BASE, slices: [{ id: "a", value: 0 }] })
    assert.ok(layout.issues.some((issue) => issue.kind === "empty"))
    assert.equal(computePieChartLayout({ ...BASE, slices: [] }).issues.length, 0)
  })
})

describe("pieChartSlicePath", () => {
  it("draws a wedge from the centre when there is no hole", () => {
    const path = pieChartSlicePath({ startAngle: 0, endAngle: Math.PI / 2 }, 0, 0, 10, 0)
    assert.ok(path.startsWith("M0,0L"))
    assert.ok(path.includes("A10,10 0 0 1"))
  })

  it("marks the large-arc flag past a half turn", () => {
    const small = pieChartSlicePath({ startAngle: 0, endAngle: Math.PI / 2 }, 0, 0, 10, 0)
    const large = pieChartSlicePath({ startAngle: 0, endAngle: (Math.PI * 3) / 2 }, 0, 0, 10, 0)
    assert.ok(small.includes("0 0 1"))
    assert.ok(large.includes("0 1 1"))
  })

  it("draws an annular sector when there is a hole", () => {
    const path = pieChartSlicePath({ startAngle: 0, endAngle: Math.PI / 2 }, 0, 0, 10, 4)
    assert.ok(!path.startsWith("M0,0"))
    assert.ok(path.includes("A4,4"))
  })

  it("splits a full turn into two arcs, and punches the hole the other way", () => {
    const solid = pieChartSlicePath({ startAngle: 0, endAngle: TAU }, 0, 0, 10, 0)
    assert.equal(solid.match(/A/g)?.length, 2)
    const donut = pieChartSlicePath({ startAngle: 0, endAngle: TAU }, 0, 0, 10, 4)
    assert.equal(donut.match(/A/g)?.length, 4)
    assert.ok(donut.includes("A4,4 0 0 0"))
  })

  it("draws nothing for an empty sweep or a collapsed radius", () => {
    assert.equal(pieChartSlicePath({ startAngle: 1, endAngle: 1 }, 0, 0, 10, 0), "")
    assert.equal(pieChartSlicePath({ startAngle: 0, endAngle: 1 }, 0, 0, 0, 0), "")
  })
})

describe("pieChartSlicePath edge cases", () => {
  it("draws a reversed range as the same wedge rather than nothing", () => {
    const forward = pieChartSlicePath({ startAngle: 0, endAngle: 1 }, 0, 0, 10, 4)
    const reversed = pieChartSlicePath({ startAngle: 1, endAngle: 0 }, 0, 0, 10, 4)
    assert.notEqual(reversed, "")
    assert.equal(reversed, forward)
  })

  it("never emits NaN when the corner radius outgrows the hole", () => {
    // A wide, shallow wedge on a small hole reaches this through the
    // arc-length clamp alone; asin would leave its domain.
    const path = pieChartSlicePath(
      { startAngle: 0, endAngle: (Math.PI * 3) / 2 },
      0,
      0,
      100,
      25,
      40,
    )
    assert.ok(!path.includes("NaN"), path)
    assert.notEqual(path, "")
  })

  it("stays finite for a non-finite span", () => {
    assert.equal(
      pieChartSlicePath({ startAngle: 0, endAngle: Number.NaN }, 0, 0, 10, 0),
      "",
    )
  })
})

describe("pieChartCentroid and pieChartLeaderPath", () => {
  it("puts the centroid on the slice midline", () => {
    const point = pieChartCentroid({ centroidAngle: 0 }, 100, 100, 40)
    assert.ok(Math.abs(point.x - 100) < 1e-9)
    assert.equal(point.y, 60)
  })

  it("breaks the leader toward the side the slice faces", () => {
    const endX = (path: string) => Number(path.split("L").at(-1)!.split(",")[0])
    assert.equal(
      endX(pieChartLeaderPath({ centroidAngle: Math.PI / 2 }, 0, 0, 10, 6, 12)),
      28,
    )
    assert.equal(
      endX(pieChartLeaderPath({ centroidAngle: -Math.PI / 2 }, 0, 0, 10, 6, 12)),
      -28,
    )
  })
})
