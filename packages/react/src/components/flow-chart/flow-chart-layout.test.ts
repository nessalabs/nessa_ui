import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeFlowChartLayout,
  flowChartCenterlinePath,
  flowChartRibbonPath,
  type FlowChartLayoutOptions,
} from "./flow-chart-layout"

const BASE: FlowChartLayoutOptions = {
  nodes: [{ id: "a" }, { id: "b" }, { id: "x" }, { id: "y" }],
  links: [
    { source: "a", target: "x", value: 3 },
    { source: "a", target: "y", value: 1 },
    { source: "b", target: "y", value: 2 },
  ],
  width: 400,
  height: 300,
  nodeWidth: 10,
  nodeGap: 12,
}

function nodeById(layout: ReturnType<typeof computeFlowChartLayout>, id: string) {
  const node = layout.nodes.find((candidate) => candidate.id === id)
  assert.ok(node, `node ${id} missing from layout`)
  return node
}

describe("computeFlowChartLayout", () => {
  it("places sources in the first column and sinks in the last", () => {
    const layout = computeFlowChartLayout(BASE)
    assert.equal(layout.columnCount, 2)
    assert.equal(nodeById(layout, "a").column, 0)
    assert.equal(nodeById(layout, "b").column, 0)
    assert.equal(nodeById(layout, "x").column, 1)
    assert.equal(nodeById(layout, "y").column, 1)
    assert.equal(nodeById(layout, "a").x, 0)
    assert.equal(nodeById(layout, "x").x, 390)
  })

  it("justify pushes pass-through sinks to the last column; left keeps them", () => {
    const options: FlowChartLayoutOptions = {
      ...BASE,
      nodes: [{ id: "a" }, { id: "m" }, { id: "z" }, { id: "s" }],
      links: [
        { source: "a", target: "m", value: 2 },
        { source: "m", target: "z", value: 2 },
        { source: "a", target: "s", value: 1 },
      ],
    }
    assert.equal(nodeById(computeFlowChartLayout(options), "s").column, 2)
    assert.equal(
      nodeById(computeFlowChartLayout({ ...options, align: "left" }), "s").column,
      1,
    )
  })

  it("right packs late sources toward the end; center parks them before their targets", () => {
    // Chain a → m → z spans three columns; p feeds z directly.
    const options: FlowChartLayoutOptions = {
      ...BASE,
      nodes: [{ id: "a" }, { id: "m" }, { id: "z" }, { id: "p" }],
      links: [
        { source: "a", target: "m", value: 2 },
        { source: "m", target: "z", value: 2 },
        { source: "p", target: "z", value: 1 },
      ],
    }
    const column = (align: "left" | "right" | "center") => {
      const layout = computeFlowChartLayout({ ...options, align })
      return layout.nodes.find((node) => node.id === "p")!.column
    }
    assert.equal(column("left"), 0)
    assert.equal(column("right"), 1)
    assert.equal(column("center"), 1)
  })

  it("barycenter iterations reorder columns to remove crossings", () => {
    // Input order stacks a over b and x over y, but the heavy links run
    // a → y and b → x: a guaranteed crossing until the order relaxes.
    const options: FlowChartLayoutOptions = {
      ...BASE,
      nodes: [{ id: "a" }, { id: "b" }, { id: "x" }, { id: "y" }],
      links: [
        { source: "a", target: "y", value: 4 },
        { source: "b", target: "x", value: 4 },
      ],
    }
    const orderOf = (iterations: number) =>
      computeFlowChartLayout({ ...options, iterations })
        .nodes.filter((node) => node.column === 1)
        .sort((first, second) => first.y - second.y)
        .map((node) => node.id)
    assert.deepEqual(orderOf(0), ["x", "y"])
    assert.deepEqual(orderOf(2), ["y", "x"])
  })

  it("emits vertical paths with the axes swapped", () => {
    const layout = computeFlowChartLayout(BASE)
    const link = layout.links[0]
    const horizontal = flowChartRibbonPath(link, 0.6)
    const vertical = flowChartRibbonPath(link, 0.6, true)
    assert.ok(horizontal.startsWith(`M ${link.sourceX} ${link.sourceY}`))
    assert.ok(vertical.startsWith(`M ${link.sourceY} ${link.sourceX}`))
  })

  it("sizes bars proportionally to flow and fills the column height", () => {
    const layout = computeFlowChartLayout(BASE)
    const a = nodeById(layout, "a")
    const b = nodeById(layout, "b")
    // a carries 4 units, b carries 2: exactly double the height.
    assert.ok(Math.abs(a.height - 2 * b.height) < 1e-9)
    // Both columns stretch to the full box: last bar ends at the bottom.
    for (const column of [0, 1]) {
      const bars = layout.nodes.filter((node) => node.column === column)
      const bottom = Math.max(...bars.map((node) => node.y + node.height))
      assert.ok(Math.abs(bottom - 300) < 1e-9, `column ${column} ends at ${bottom}`)
      assert.equal(Math.min(...bars.map((node) => node.y)), 0)
    }
  })

  it("keeps at least the requested gap between bars", () => {
    const layout = computeFlowChartLayout({ ...BASE, height: 40 })
    const a = nodeById(layout, "a")
    const b = nodeById(layout, "b")
    assert.ok(b.y - (a.y + a.height) >= 12 - 1e-9)
  })

  it("stacks link slots contiguously along both endpoint bars", () => {
    const layout = computeFlowChartLayout(BASE)
    const a = nodeById(layout, "a")
    const y = nodeById(layout, "y")
    const fromA = layout.links.filter((link) => link.source === "a")
    const slotSum = fromA.reduce((sum, link) => sum + link.thickness, 0)
    assert.ok(Math.abs(slotSum - a.height) < 1e-9)
    const intoY = layout.links
      .filter((link) => link.target === "y")
      .sort((first, second) => first.targetY - second.targetY)
    assert.ok(Math.abs(intoY[0].targetY - y.y) < 1e-9)
    assert.ok(
      Math.abs(intoY[1].targetY - (y.y + intoY[0].thickness)) < 1e-9,
    )
    assert.ok(
      Math.abs(
        intoY[0].thickness + intoY[1].thickness - y.height,
      ) < 1e-9,
    )
  })

  it("ignores non-positive links and centers a lone bar in its column", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      nodes: [{ id: "a" }, { id: "x" }],
      links: [
        { source: "a", target: "x", value: 5 },
        { source: "a", target: "x", value: 0 },
      ],
    })
    assert.equal(layout.links.length, 1)
    const a = nodeById(layout, "a")
    assert.ok(Math.abs(a.y - (300 - a.height) / 2) < 1e-9)
  })

  it("tolerates partial mid-stream data: unknown endpoints, self links, duplicates", () => {
    // A link whose endpoint has not arrived yet is skipped this frame.
    const partial = computeFlowChartLayout({
      ...BASE,
      links: [
        { source: "a", target: "x", value: 2 },
        { source: "a", target: "ghost", value: 1 },
        { source: "a", target: "a", value: 1 },
      ],
    })
    assert.equal(partial.links.length, 1)
    assert.equal(partial.links[0].target, "x")
    assert.deepEqual(
      partial.issues.map((issue) => issue.kind).sort(),
      ["self-link", "unknown-endpoint"],
    )
    assert.equal(
      partial.issues.find((issue) => issue.kind === "unknown-endpoint")!
        .linkIndex,
      1,
    )
    // Duplicate node ids keep their first occurrence.
    const deduped = computeFlowChartLayout({
      ...BASE,
      nodes: [...BASE.nodes, { id: "a" }],
    })
    assert.equal(deduped.nodes.length, BASE.nodes.length)
    assert.equal(deduped.issues[0].kind, "duplicate-node")
    // Fully consistent data reports no issues — the success signal.
    assert.deepEqual(computeFlowChartLayout(BASE).issues, [])
  })

  it("drops non-finite link values and reports them", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      links: [
        { source: "a", target: "x", value: 2 },
        { source: "a", target: "y", value: NaN },
        { source: "b", target: "y", value: Infinity },
      ],
    })
    assert.equal(layout.links.length, 1)
    assert.equal(
      layout.issues.filter((issue) => issue.kind === "invalid-value").length,
      2,
    )
    for (const node of layout.nodes) {
      assert.ok(Number.isFinite(node.height) && Number.isFinite(node.y))
    }
  })

  it("keeps linkless nodes at their depth instead of justifying them right", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      links: [{ source: "a", target: "b", value: 1 }],
    })
    assert.equal(
      layout.nodes.find((node) => node.id === "c")!.column,
      0,
    )
  })

  it("clamps the column gap at zero in boxes narrower than the columns", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      width: 30,
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      links: [
        { source: "a", target: "b", value: 1 },
        { source: "b", target: "c", value: 1 },
      ],
    })
    const xs = layout.nodes
      .sort((first, second) => first.column - second.column)
      .map((node) => node.x)
    assert.deepEqual(xs, [0, 10, 20])
  })

  it("falls back to depth placement for align right when the data has a cycle", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      align: "right",
      nodes: ["a", "b", "c", "d", "e"].map((id) => ({ id })),
      links: [
        { source: "a", target: "b", value: 1 },
        { source: "b", target: "c", value: 1 },
        { source: "c", target: "d", value: 1 },
        { source: "d", target: "e", value: 1 },
        { source: "e", target: "d", value: 1 },
      ],
    })
    const column = (id: string) =>
      layout.nodes.find((node) => node.id === id)!.column
    assert.equal(column("a"), 0)
    assert.ok(column("d") > column("c"))
  })

  it("breaks cycles deterministically instead of failing", () => {
    const layout = computeFlowChartLayout({
      ...BASE,
      links: [
        { source: "a", target: "x", value: 1 },
        { source: "x", target: "b", value: 1 },
        { source: "b", target: "a", value: 1 },
      ],
    })
    assert.equal(layout.links.length, 3)
    for (const node of layout.nodes) {
      assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y))
    }
    // Input-order placement (nodes arrive a, b, x): a and b lead with no
    // placed predecessors; x follows its placed predecessor a.
    const column = (id: string) =>
      layout.nodes.find((node) => node.id === id)!.column
    assert.equal(column("a"), 0)
    assert.equal(column("b"), 0)
    assert.equal(column("x"), 1)
    assert.ok(layout.issues.some((issue) => issue.kind === "cycle"))
  })

  it("survives a zero-height box without NaN geometry", () => {
    const layout = computeFlowChartLayout({ ...BASE, height: 0 })
    for (const node of layout.nodes) {
      assert.ok(Number.isFinite(node.y) && Number.isFinite(node.height))
    }
    for (const link of layout.links) {
      assert.ok(Number.isFinite(link.sourceY) && Number.isFinite(link.thickness))
    }
  })
})

describe("ribbon paths", () => {
  it("draws a closed band between the bar edges", () => {
    const layout = computeFlowChartLayout(BASE)
    const link = layout.links[0]
    const path = flowChartRibbonPath(link, 0.6)
    assert.ok(path.startsWith(`M ${link.sourceX} ${link.sourceY}`))
    assert.ok(path.endsWith("Z"))
    assert.ok(path.includes(`${link.targetX} ${link.targetY}`))
  })

  it("centerline runs through the ribbon middle", () => {
    const layout = computeFlowChartLayout(BASE)
    const link = layout.links[0]
    const path = flowChartCenterlinePath(link)
    assert.ok(
      path.startsWith(`M ${link.sourceX} ${link.sourceY + link.thickness / 2}`),
    )
  })
})
