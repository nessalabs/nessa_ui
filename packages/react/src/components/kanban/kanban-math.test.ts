/** @responsibility Verifies the kanban list math: insertion indexes follow card midpoints, indicator positions land in the right gaps, and applied moves transform column maps correctly. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  applyKanbanMove,
  kanbanGapTop,
  kanbanInsertionIndex,
} from "./kanban-math"

const cards = [
  { top: 0, height: 40 },
  { top: 48, height: 40 },
  { top: 96, height: 40 },
]

describe("kanbanInsertionIndex", () => {
  test("inserts before the first card above its midpoint", () => {
    assert.equal(kanbanInsertionIndex(cards, 10), 0)
  })

  test("inserts between cards when past a midpoint", () => {
    assert.equal(kanbanInsertionIndex(cards, 30), 1)
    assert.equal(kanbanInsertionIndex(cards, 80), 2)
  })

  test("inserts after the last card below everything", () => {
    assert.equal(kanbanInsertionIndex(cards, 500), 3)
  })

  test("an empty column always inserts at zero", () => {
    assert.equal(kanbanInsertionIndex([], 123), 0)
  })
})

describe("kanbanGapTop", () => {
  test("opens the slot above the first card for index zero", () => {
    assert.equal(kanbanGapTop(cards, 0, 0, 8), 0)
  })

  test("opens the slot where the first shifted card sits", () => {
    // Card 1 currently sits at 48; it shifts down and the slot takes its
    // place, so the slot begins exactly there.
    assert.equal(kanbanGapTop(cards, 1, 0, 8), 48)
    assert.equal(kanbanGapTop(cards, 2, 0, 8), 96)
  })

  test("opens the slot one spacing below the last card at the end", () => {
    assert.equal(kanbanGapTop(cards, 3, 0, 8), 144)
  })

  test("uses the empty-column position when there are no cards", () => {
    assert.equal(kanbanGapTop([], 0, 6, 8), 6)
  })

  test("clamps an out-of-range index", () => {
    assert.equal(kanbanGapTop(cards, 99, 0, 8), 144)
  })
})

describe("applyKanbanMove", () => {
  const columns = {
    todo: ["a", "b", "c"],
    doing: ["d"],
    done: [],
  }

  test("moves a card between columns at the given index", () => {
    const next = applyKanbanMove(columns, {
      cardId: "b",
      fromColumn: "todo",
      toColumn: "doing",
      index: 1,
    })

    assert.deepEqual(next.todo, ["a", "c"])
    assert.deepEqual(next.doing, ["d", "b"])
    assert.deepEqual(next.done, [])
  })

  test("reorders within one column using the removed-first index", () => {
    const next = applyKanbanMove(columns, {
      cardId: "a",
      fromColumn: "todo",
      toColumn: "todo",
      index: 2,
    })

    assert.deepEqual(next.todo, ["b", "c", "a"])
  })

  test("a move back to the original position is a no-op reorder", () => {
    const next = applyKanbanMove(columns, {
      cardId: "b",
      fromColumn: "todo",
      toColumn: "todo",
      index: 1,
    })

    assert.deepEqual(next.todo, ["a", "b", "c"])
  })

  test("clamps an out-of-range target index", () => {
    const next = applyKanbanMove(columns, {
      cardId: "a",
      fromColumn: "todo",
      toColumn: "done",
      index: 99,
    })

    assert.deepEqual(next.done, ["a"])
  })

  test("does not mutate the source map", () => {
    applyKanbanMove(columns, {
      cardId: "a",
      fromColumn: "todo",
      toColumn: "doing",
      index: 0,
    })

    assert.deepEqual(columns.todo, ["a", "b", "c"])
    assert.deepEqual(columns.doing, ["d"])
  })
})
