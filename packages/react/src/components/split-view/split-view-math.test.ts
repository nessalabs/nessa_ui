/** @responsibility Verifies the ported SplitView percentage mathematics against the behaviors documented upstream. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  adjustLayoutByDelta,
  calculateDefaultLayout,
  calculateSeparatorAriaValues,
  resolveSizeToPercentage,
  validatePanelGroupLayout,
  type SplitViewPanelConstraints,
} from "./split-view-math"

/**
 * Builds relaxed constraints for one panel.
 *
 * @param panelId - The panel id.
 * @param overrides - Constraint values to override.
 * @returns The panel constraints.
 */
function constraints(
  panelId: string,
  overrides: Partial<SplitViewPanelConstraints> = {},
): SplitViewPanelConstraints {
  return {
    panelId,
    minSize: 0,
    maxSize: 100,
    collapsedSize: 0,
    collapsible: false,
    ...overrides,
  }
}

describe("adjustLayoutByDelta", () => {
  test("moves size across the pivot", () => {
    const next = adjustLayoutByDelta({
      delta: 10,
      initialLayout: { a: 50, b: 50 },
      panelConstraints: [constraints("a"), constraints("b")],
      pivotIndices: [0, 1],
      prevLayout: { a: 50, b: 50 },
      trigger: "pointer",
    })

    assert.deepEqual(next, { a: 60, b: 40 })
  })

  test("cascades the shrink through constrained neighbors", () => {
    const panelConstraints = [
      constraints("a", { minSize: 20 }),
      constraints("b", { minSize: 20 }),
      constraints("c", { minSize: 20 }),
    ]

    const next = adjustLayoutByDelta({
      delta: 25,
      initialLayout: { a: 40, b: 30, c: 30 },
      panelConstraints,
      pivotIndices: [0, 1],
      prevLayout: { a: 40, b: 30, c: 30 },
      trigger: "pointer",
    })

    assert.deepEqual(next, { a: 60, b: 20, c: 20 })
  })

  test("ignores drags past an exhausted boundary", () => {
    const panelConstraints = [
      constraints("a", { minSize: 20 }),
      constraints("b", { minSize: 20 }),
    ]
    const prevLayout = { a: 80, b: 20 }

    const next = adjustLayoutByDelta({
      delta: 15,
      initialLayout: prevLayout,
      panelConstraints,
      pivotIndices: [0, 1],
      prevLayout,
      trigger: "pointer",
    })

    assert.equal(next, prevLayout)
  })

  test("snaps a collapsed panel open only past the halfway point", () => {
    const panelConstraints = [
      constraints("a", { minSize: 20, collapsedSize: 5, collapsible: true }),
      constraints("b"),
    ]
    const initialLayout = { a: 5, b: 95 }

    const before = adjustLayoutByDelta({
      delta: 7,
      initialLayout,
      panelConstraints,
      pivotIndices: [0, 1],
      prevLayout: initialLayout,
      trigger: "pointer",
    })

    assert.deepEqual(before, initialLayout)

    const after = adjustLayoutByDelta({
      delta: 8,
      initialLayout,
      panelConstraints,
      pivotIndices: [0, 1],
      prevLayout: initialLayout,
      trigger: "pointer",
    })

    assert.deepEqual(after, { a: 20, b: 80 })
  })

  test("keyboard input expands a collapsed panel without the halfway check", () => {
    const panelConstraints = [
      constraints("a", { minSize: 20, collapsedSize: 5, collapsible: true }),
      constraints("b"),
    ]
    const initialLayout = { a: 5, b: 95 }

    const next = adjustLayoutByDelta({
      delta: 5,
      initialLayout,
      panelConstraints,
      pivotIndices: [0, 1],
      prevLayout: initialLayout,
      trigger: "keyboard",
    })

    assert.deepEqual(next, { a: 20, b: 80 })
  })
})

describe("validatePanelGroupLayout", () => {
  test("rescales layouts that do not total one hundred", () => {
    const next = validatePanelGroupLayout({
      layout: { a: 30, b: 30 },
      panelConstraints: [constraints("a"), constraints("b")],
    })

    assert.deepEqual(next, { a: 50, b: 50 })
  })

  test("clamps sizes and redistributes the remainder", () => {
    const next = validatePanelGroupLayout({
      layout: { a: 90, b: 10 },
      panelConstraints: [constraints("a", { maxSize: 60 }), constraints("b")],
    })

    assert.deepEqual(next, { a: 60, b: 40 })
  })

  test("recovers from zero and broken totals with an even split", () => {
    assert.deepEqual(
      validatePanelGroupLayout({
        layout: { a: 0, b: 0 },
        panelConstraints: [constraints("a"), constraints("b")],
      }),
      { a: 50, b: 50 },
    )
    assert.deepEqual(
      validatePanelGroupLayout({
        layout: { a: Number.NaN, b: 50 },
        panelConstraints: [constraints("a"), constraints("b")],
      }),
      { a: 50, b: 50 },
    )
  })

  test("throws when panel counts mismatch", () => {
    assert.throws(() =>
      validatePanelGroupLayout({
        layout: { a: 100 },
        panelConstraints: [constraints("a"), constraints("b")],
      }),
    )
  })
})

describe("calculateDefaultLayout", () => {
  test("honors explicit defaults and divides the remainder evenly", () => {
    const layout = calculateDefaultLayout([
      constraints("a", { defaultSize: 30 }),
      constraints("b"),
      constraints("c"),
    ])

    assert.deepEqual(layout, { a: 30, b: 35, c: 35 })
  })
})

describe("calculateSeparatorAriaValues", () => {
  test("reports the reachable range given neighboring constraints", () => {
    const values = calculateSeparatorAriaValues({
      layout: { a: 50, b: 50 },
      panelConstraints: [
        constraints("a", { minSize: 10 }),
        constraints("b", { minSize: 20 }),
      ],
      panelId: "a",
      panelIndex: 0,
    })

    assert.equal(values.valueNow, 50)
    assert.equal(values.valueMin, 10)
    assert.equal(values.valueMax, 80)
  })
})

describe("resolveSizeToPercentage", () => {
  test("resolves numbers, percentages, and pixels", () => {
    assert.equal(resolveSizeToPercentage(25, 960), 25)
    assert.equal(resolveSizeToPercentage("25%", 960), 25)
    assert.equal(resolveSizeToPercentage("240px", 960), 25)
    assert.equal(resolveSizeToPercentage("240px", 0), undefined)
    assert.equal(resolveSizeToPercentage(undefined, 960), undefined)
  })

  test("ignores negative and broken sizes", () => {
    assert.equal(resolveSizeToPercentage(-5, 960), undefined)
    assert.equal(resolveSizeToPercentage(Number.NaN, 960), undefined)
    assert.equal(resolveSizeToPercentage(Number.POSITIVE_INFINITY, 960), undefined)
    assert.equal(resolveSizeToPercentage("-48px", 960), undefined)
  })
})
