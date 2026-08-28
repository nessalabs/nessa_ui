import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeSankeyLayout,
  sankeyCenterlinePath,
  sankeyRibbonPath,
  type SankeyLayoutOptions,
} from "./sankey-chart-layout"

const BASE: SankeyLayoutOptions = {
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

function nodeById(layout: ReturnType<typeof computeSankeyLayout>, id: string) {
  const node = layout.nodes.find((candidate) => candidate.id === id)
  assert.ok(node, `node ${id} missing from layout`)
  return node
}

describe("computeSankeyLayout", () => {
  it("places sources in the first column and sinks in the last", () => {
    const layout = computeSankeyLayout(BASE)
    assert.equal(layout.columnCount, 2)
    assert.equal(nodeById(layout, "a").column, 0)
    assert.equal(nodeById(layout, "b").column, 0)
    assert.equal(nodeById(layout, "x").column, 1)
    assert.equal(nodeById(layout, "y").column, 1)
    assert.equal(nodeById(layout, "a").x, 0)
    assert.equal(nodeById(layout, "x").x, 390)
  })

  it("justify pushes pass-through sinks to the last column; left keeps them", () => {
    const options: SankeyLayoutOptions = {
      ...BASE,
      nodes: [{ id: "a" }, { id: "m" }, { id: "z" }, { id: "s" }],
      links: [
        { source: "a", target: "m", value: 2 },
        { source: "m", target: "z", value: 2 },
        { source: "a", target: "s", value: 1 },
      ],
    }
    assert.equal(nodeById(computeSankeyLayout(options), "s").column, 2)
    assert.equal(
      nodeById(computeSankeyLayout({ ...options, align: "left" }), "s").column,
      1,
    )
  })

  it("sizes bars proportionally to flow and fills the column height", () => {
    const layout = computeSankeyLayout(BASE)
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
    const layout = computeSankeyLayout({ ...BASE, height: 40 })
    const a = nodeById(layout, "a")
    const b = nodeById(layout, "b")
    assert.ok(b.y - (a.y + a.height) >= 12 - 1e-9)
  })

  it("stacks link slots contiguously along both endpoint bars", () => {
    const layout = computeSankeyLayout(BASE)
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
    const layout = computeSankeyLayout({
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

  it("rejects unknown endpoints, self links, duplicate ids, and cycles", () => {
    assert.throws(() =>
      computeSankeyLayout({
        ...BASE,
        links: [{ source: "a", target: "ghost", value: 1 }],
      }),
    )
    assert.throws(() =>
      computeSankeyLayout({
        ...BASE,
        links: [{ source: "a", target: "a", value: 1 }],
      }),
    )
    assert.throws(() =>
      computeSankeyLayout({ ...BASE, nodes: [...BASE.nodes, { id: "a" }] }),
    )
    assert.throws(() =>
      computeSankeyLayout({
        ...BASE,
        links: [
          { source: "a", target: "x", value: 1 },
          { source: "x", target: "b", value: 1 },
          { source: "b", target: "a", value: 1 },
        ],
      }),
    )
  })

  it("survives a zero-height box without NaN geometry", () => {
    const layout = computeSankeyLayout({ ...BASE, height: 0 })
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
    const layout = computeSankeyLayout(BASE)
    const link = layout.links[0]
    const path = sankeyRibbonPath(link, 0.6)
    assert.ok(path.startsWith(`M ${link.sourceX} ${link.sourceY}`))
    assert.ok(path.endsWith("Z"))
    assert.ok(path.includes(`${link.targetX} ${link.targetY}`))
  })

  it("centerline runs through the ribbon middle", () => {
    const layout = computeSankeyLayout(BASE)
    const link = layout.links[0]
    const path = sankeyCenterlinePath(link)
    assert.ok(
      path.startsWith(`M ${link.sourceX} ${link.sourceY + link.thickness / 2}`),
    )
  })
})
