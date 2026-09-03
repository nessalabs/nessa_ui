/** @responsibility Verifies the WindowDeck overview strip: visible-count, uniform scale, overflow, and the degenerate viewports. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  clampOverviewScroll,
  computeOverviewColumns,
  computeOverviewLayout,
  computeOverviewTiles,
  computeOverviewVisibleCount,
  overviewPreviewInView,
  overviewScrollToCentre,
  overviewScrollToReveal,
  type WindowDeckRect,
} from "./window-deck-layout"

/**
 * Lays panes out and asserts the deck had room for a strip at all.
 *
 * @param rects - The panes' rectangles.
 * @param viewport - The space the visible page is laid out inside.
 * @param options - Visible-count, gap, and inset overrides.
 * @returns The layout, once proven non-null.
 */
function layoutFor(
  rects: readonly WindowDeckRect[],
  viewport: { width: number; height: number },
  options?: Parameters<typeof computeOverviewLayout>[2],
) {
  const layout = computeOverviewLayout(rects, viewport, options)

  assert.notEqual(layout, null, "expected the deck to have room for a strip")
  return layout!
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
  test("caps a deep deck at the default page size on a wide viewport", () => {
    assert.equal(computeOverviewColumns(20, 1440), 8)
    assert.equal(computeOverviewColumns(6, 1440), 6)
  })

  test("honours an explicit cap", () => {
    assert.equal(computeOverviewColumns(20, 1440, 4), 4)
  })

  test("drops the page size when the viewport cannot hold the cap", () => {
    assert.ok(computeOverviewColumns(20, 480) < 8)
    assert.ok(computeOverviewColumns(20, 480) >= 1)
  })

  test("never asks for more tiles than there are panes", () => {
    assert.equal(computeOverviewColumns(1, 1440), 1)
    assert.equal(computeOverviewColumns(2, 1440), 2)
  })

  test("reports no tiles for an empty deck", () => {
    assert.equal(computeOverviewColumns(0, 1440), 0)
  })
})

describe("computeOverviewVisibleCount", () => {
  test("reads maxVisible and columns as the same cap", () => {
    assert.equal(
      computeOverviewVisibleCount(20, 1440, { maxVisible: 3 }),
      computeOverviewVisibleCount(20, 1440, { columns: 3 }),
    )
  })
})

describe("computeOverviewLayout", () => {
  test("returns an empty strip for an empty deck", () => {
    const layout = computeOverviewLayout([], { width: 1440, height: 900 })

    assert.deepEqual(layout, {
      tiles: [],
      centres: [],
      contentWidth: 1440,
      visibleCount: 0,
      tileWidth: 0,
    })
  })

  test("scales every pane by one shared factor", () => {
    const { tiles } = layoutFor(rail(6), { width: 1440, height: 900 })

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
    const tiles = layoutFor(mixed, { width: 1440, height: 900 }).tiles

    assert.equal(tiles[0].scale, tiles[1].scale)
    const uniform = layoutFor(rail(2), { width: 1440, height: 900 }).tiles[0].scale
    assert.ok(tiles[0].scale < uniform)
  })

  test("lays a page that fits as one centred row", () => {
    const viewport = { width: 1440, height: 900 }
    const { tiles, centres, contentWidth, visibleCount } = layoutFor(
      rail(5),
      viewport,
    )
    const rects = rail(5)
    const centreOf = (index: number) =>
      rects[index].left + rects[index].width / 2 + tiles[index].x

    assert.equal(visibleCount, 5)
    assert.equal(contentWidth, viewport.width)
    assert.ok(Math.abs((centres[0].x + centres[4].x) / 2 - viewport.width / 2) < 0.001)
    assert.ok(Math.abs((centreOf(0) + centreOf(4)) / 2 - viewport.width / 2) < 0.001)
    for (const index of [1, 2, 3, 4]) {
      assert.ok(Math.abs(centres[index].y - centres[0].y) < 0.001)
    }
  })

  test("extends a deep deck sideways instead of shrinking the page", () => {
    const viewport = { width: 1440, height: 900 }
    const page = layoutFor(rail(8), viewport)
    const deep = layoutFor(rail(20), viewport)

    assert.equal(page.visibleCount, 8)
    assert.equal(deep.visibleCount, 8)
    assert.equal(page.tileWidth, deep.tileWidth)
    assert.equal(page.tiles[0].scale, deep.tiles[0].scale)
    assert.ok(deep.contentWidth > viewport.width)
    assert.ok(deep.centres[19].x > viewport.width)
    assert.ok(deep.centres[0].x < viewport.width)
  })

  test("honours an explicit visible count", () => {
    const { visibleCount, contentWidth, centres } = layoutFor(
      rail(10),
      { width: 1440, height: 900 },
      { maxVisible: 4 },
    )

    assert.equal(visibleCount, 4)
    assert.ok(contentWidth > 1440)
    assert.ok(centres[4].x > 1440)
  })

  test("never enlarges a pane that already fits its tile", () => {
    const { tiles } = layoutFor(rail(1, { width: 40, height: 40 }), {
      width: 1440,
      height: 900,
    })

    assert.equal(tiles[0].scale, 1)
  })

  test("refuses a layout when the viewport has no room for one", () => {
    // The caller must stay in the carousel: identity transforms here would
    // leave a mode where nothing moved and the strip cannot be read.
    assert.equal(computeOverviewTiles(rail(3), { width: 40, height: 40 }), null)
    assert.equal(computeOverviewLayout(rail(3), { width: 40, height: 40 }), null)
  })

  test("still lays out a short viewport by scrolling rather than refusing", () => {
    const layout = layoutFor(rail(20), { width: 1440, height: 300 })

    assert.equal(layout.visibleCount, 8)
    assert.ok(layout.tiles[0].scale > 0.12)
    assert.ok(layout.contentWidth > 1440)
  })
})

describe("overview scroll helpers", () => {
  test("clamps to the leftover width", () => {
    assert.equal(clampOverviewScroll(-20, 2000, 1440), 0)
    assert.equal(clampOverviewScroll(800, 2000, 1440), 560)
    assert.equal(clampOverviewScroll(100, 1000, 1440), 0)
  })

  test("centres a tile and reveals one that has left the page", () => {
    assert.equal(overviewScrollToCentre(1800, 3000, 1440), 1080)
    assert.equal(overviewScrollToReveal(200, 160, 3000, 1440, 0), 0)
    assert.ok(overviewScrollToReveal(2000, 160, 3000, 1440, 0) > 0)
  })

  test("treats the next cell as still in view for preview mounting", () => {
    assert.equal(overviewPreviewInView(200, 160, 0, 1440), true)
    assert.equal(overviewPreviewInView(2000, 160, 0, 1440), false)
    assert.equal(overviewPreviewInView(1500, 160, 0, 1440, 160), true)
  })
})
