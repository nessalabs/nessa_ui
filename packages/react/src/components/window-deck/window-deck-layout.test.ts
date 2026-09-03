/** @responsibility Verifies the WindowDeck overview geometry: column choice, uniform scale, centring, and the degenerate viewports. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  computeOverviewColumns,
  computeOverviewTiles,
  type WindowDeckRect,
} from "./window-deck-layout"

/**
 * Lays panes out and asserts the deck had room for a grid at all.
 *
 * @param rects - The panes' rectangles.
 * @param viewport - The space the grid is laid out inside.
 * @param options - Column, row, gap, and inset overrides.
 * @returns The transforms, once proven non-null.
 */
function tilesFor(
  rects: readonly WindowDeckRect[],
  viewport: { width: number; height: number },
  options?: Parameters<typeof computeOverviewTiles>[2],
) {
  const tiles = computeOverviewTiles(rects, viewport, options)

  assert.notEqual(tiles, null, "expected the deck to have room for a grid")
  return tiles as { x: number; y: number; scale: number }[]
}

/**
 * Builds a row of identical rectangles laid out left to right, as the
 * carousel rail presents them.
 *
 * @param count - How many rectangles to build.
 * @param size - The width and height each rectangle takes.
 * @returns The rectangles, in pane order.
 */
function rail(
  count: number,
  size: { width: number; height: number } = { width: 400, height: 600 },
): WindowDeckRect[] {
  return Array.from({ length: count }, (_, index) => ({
    left: index * (size.width + 40),
    top: 100,
    width: size.width,
    height: size.height,
  }))
}

describe("computeOverviewColumns", () => {
  test("takes three columns on a wide viewport and two when narrow", () => {
    assert.equal(computeOverviewColumns(6, 1440), 3)
    assert.equal(computeOverviewColumns(6, 600), 2)
  })

  test("widens rather than deepening past the row cap", () => {
    assert.equal(computeOverviewColumns(20, 1440), 7)
    assert.equal(computeOverviewColumns(20, 1440, 4), 5)
    assert.equal(computeOverviewColumns(9, 1440), 3)
  })

  test("never asks for more columns than there are panes", () => {
    assert.equal(computeOverviewColumns(1, 1440), 1)
    assert.equal(computeOverviewColumns(2, 1440), 2)
  })

  test("reports no columns for an empty deck", () => {
    assert.equal(computeOverviewColumns(0, 1440), 0)
  })
})

describe("computeOverviewTiles", () => {
  test("returns nothing for an empty deck", () => {
    assert.deepEqual(computeOverviewTiles([], { width: 1440, height: 900 }), [])
  })

  test("scales every pane by one shared factor", () => {
    const tiles = tilesFor(rail(6), { width: 1440, height: 900 })

    assert.equal(tiles.length, 6)
    for (const tile of tiles) {
      assert.equal(tile.scale, tiles[0].scale)
    }
    assert.ok(tiles[0].scale > 0 && tiles[0].scale < 1)
  })

  test("lets the least generously fitting pane set the shared scale", () => {
    const mixed = [
      { left: 0, top: 0, width: 400, height: 600 },
      { left: 440, top: 0, width: 900, height: 600 },
    ]
    const tiles = tilesFor(mixed, { width: 1440, height: 900 })

    assert.equal(tiles[0].scale, tiles[1].scale)
    // The 900px-wide pane is the binding constraint, not the 400px one.
    const uniform = tilesFor(rail(2), { width: 1440, height: 900 })[0].scale
    assert.ok(tiles[0].scale < uniform)
  })

  test("centres each row, including a short final row", () => {
    const viewport = { width: 1440, height: 900 }
    const tiles = tilesFor(rail(5), viewport)
    const rects = rail(5)
    const centreOf = (index: number) =>
      rects[index].left + rects[index].width / 2 + tiles[index].x

    // Row one holds three tiles; row two holds two, centred on the same axis.
    const firstRowCentre = (centreOf(0) + centreOf(2)) / 2
    const lastRowCentre = (centreOf(3) + centreOf(4)) / 2

    assert.ok(Math.abs(firstRowCentre - viewport.width / 2) < 0.001)
    assert.ok(Math.abs(lastRowCentre - viewport.width / 2) < 0.001)
  })

  test("stacks rows in reading order", () => {
    const tiles = tilesFor(rail(6), { width: 1440, height: 900 })
    const rects = rail(6)
    const topOf = (index: number) => rects[index].top + tiles[index].y

    assert.ok(Math.abs(topOf(0) - topOf(1)) < 0.001)
    assert.ok(topOf(3) > topOf(0))
  })

  test("honours an explicit column count", () => {
    const tiles = tilesFor(rail(4), { width: 1440, height: 900 }, { columns: 4 })
    const rects = rail(4)
    const topOf = (index: number) => rects[index].top + tiles[index].y

    for (const index of [1, 2, 3]) {
      assert.ok(Math.abs(topOf(index) - topOf(0)) < 0.001)
    }
  })

  test("never enlarges a pane that already fits its tile", () => {
    const tiles = tilesFor(rail(1, { width: 40, height: 40 }), {
      width: 1440,
      height: 900,
    })

    assert.equal(tiles[0].scale, 1)
  })

  test("refuses a layout when the viewport has no room for one", () => {
    // The caller must stay in the carousel: identity transforms here would
    // leave a mode where nothing moved and nothing beyond the fold is
    // reachable.
    assert.equal(computeOverviewTiles(rail(3), { width: 40, height: 40 }), null)
    assert.equal(computeOverviewTiles(rail(20), { width: 1440, height: 300 }), null)
  })

  test("keeps a deep deck readable by widening instead of shrinking", () => {
    const viewport = { width: 1440, height: 900 }
    const shallow = tilesFor(rail(6), viewport)[0].scale
    const deep = tilesFor(rail(20), viewport)[0].scale

    // Twenty windows in three columns would be seven rows of unreadable
    // smudges; the grid takes more columns instead.
    assert.ok(deep > 0.3, `expected a legible tile, got scale ${deep}`)
    assert.ok(deep < shallow)
  })
})
