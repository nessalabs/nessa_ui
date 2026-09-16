/** @responsibility Verifies the one keyboard policy both Nessa listboxes navigate by. */

import assert from "node:assert/strict"
import test from "node:test"

import {
  indexOfOrigin,
  isNavigationKey,
  nextNavigationIndex,
  type ListboxEntry,
} from "./listbox-collection"

/**
 * These exercise the functions the hook itself calls, not copies of them.
 *
 * An earlier version of this file reimplemented the arithmetic and tested the
 * reimplementation, which passes just as happily when the real one is broken:
 * a second implementation to maintain, proving nothing about the first.
 */

/** A keystroke as `isNavigationKey` sees it. */
function keystroke(
  key: string,
  modifiers: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {},
) {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  }
}

test("ArrowDown walks forward and wraps at the end", () => {
  assert.equal(nextNavigationIndex("ArrowDown", 0, 3), 1)
  assert.equal(nextNavigationIndex("ArrowDown", 1, 3), 2)
  assert.equal(nextNavigationIndex("ArrowDown", 2, 3), 0)
})

test("ArrowUp walks back and wraps at the start", () => {
  assert.equal(nextNavigationIndex("ArrowUp", 2, 3), 1)
  assert.equal(nextNavigationIndex("ArrowUp", 0, 3), 2)
})

test("with nothing focused, either arrow enters the collection", () => {
  // -1 is "the keystroke came from the search field, not from a row".
  assert.equal(nextNavigationIndex("ArrowDown", -1, 3), 0)
  assert.equal(nextNavigationIndex("ArrowUp", -1, 3), 2)
})

test("Home and End reach the ends of the whole collection", () => {
  assert.equal(nextNavigationIndex("Home", 2, 4), 0)
  assert.equal(nextNavigationIndex("End", 0, 4), 3)
})

test("a single row is its own wrap target in both directions", () => {
  assert.equal(nextNavigationIndex("ArrowDown", 0, 1), 0)
  assert.equal(nextNavigationIndex("ArrowUp", 0, 1), 0)
})

test("an empty collection has nowhere to move", () => {
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.equal(nextNavigationIndex(key, -1, 0), null, `${key} on an empty list`)
  }
})

test("a key the collection does not own moves nothing", () => {
  for (const key of ["Enter", " ", "Escape", "Tab", "ArrowLeft", "PageDown", "a"]) {
    assert.equal(nextNavigationIndex(key, 0, 3), null, `${key} must not move`)
  }
})

/**
 * The guard one listbox had and the other did not. A modified Arrow key is
 * somebody else's shortcut, and a listbox that consumes it has stolen a
 * keystroke rather than handled one.
 */
test("a modified arrow key is left alone", () => {
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
    assert.equal(
      isNavigationKey(keystroke("ArrowDown", { [modifier]: true })),
      false,
      `${modifier}+ArrowDown must not be consumed`,
    )
  }
  assert.equal(isNavigationKey(keystroke("ArrowDown")), true)
})

test("Home and End belong to the caret in a text field", () => {
  assert.equal(isNavigationKey(keystroke("Home"), false), false)
  assert.equal(isNavigationKey(keystroke("End"), false), false)
  // The arrows still enter the list from the field.
  assert.equal(isNavigationKey(keystroke("ArrowDown"), false), true)
  // And from a row, the ends are reachable.
  assert.equal(isNavigationKey(keystroke("Home")), true)
})

test("keys the collection has no business with are ignored", () => {
  for (const key of ["Enter", " ", "Escape", "Tab", "ArrowLeft", "PageDown", "a"]) {
    assert.equal(isNavigationKey(keystroke(key)), false, `${key} must pass through`)
  }
})

const rows = (...ids: string[]): ListboxEntry[] =>
  ids.map((id) => ({ id, disabled: false }))

test("an empty id is a row like any other, at the front of the list", () => {
  const navigable = rows("", "b", "c")
  const index = indexOfOrigin(navigable, "")
  assert.equal(index, 0)
  assert.equal(navigable[nextNavigationIndex("ArrowDown", index, 3)!]!.id, "b")
  assert.equal(navigable[nextNavigationIndex("ArrowUp", index, 3)!]!.id, "c")
})

test("an empty id is a row like any other, in the middle of the list", () => {
  const navigable = rows("a", "", "c")
  const index = indexOfOrigin(navigable, "")
  assert.equal(index, 1)
  assert.equal(navigable[nextNavigationIndex("ArrowDown", index, 3)!]!.id, "c")
  assert.equal(navigable[nextNavigationIndex("ArrowUp", index, 3)!]!.id, "a")
})

test("an omitted origin still means the search field above the list", () => {
  const navigable = rows("a", "b", "c")
  assert.equal(indexOfOrigin(navigable, undefined), -1)
  assert.equal(navigable[nextNavigationIndex("ArrowDown", -1, 3)!]!.id, "a")
})

test("an id that is no longer in the collection enters from the top", () => {
  const navigable = rows("a", "b")
  // Filtered away between the keydown and the lookup: -1, which ArrowDown
  // reads as "enter at the first row" rather than as an error.
  assert.equal(indexOfOrigin(navigable, "gone"), -1)
  assert.equal(navigable[nextNavigationIndex("ArrowDown", -1, 2)!]!.id, "a")
})

/**
 * `focusable` keeps disabled rows in the sequence so a reader can hear why an
 * option is unavailable; `skipped` steps over them. Both are legitimate — the
 * defect was that each listbox decided privately and neither said so.
 */
test("the disabled policy decides which rows navigation visits", () => {
  const entries: ListboxEntry[] = [
    { id: "a", disabled: false },
    { id: "b", disabled: true },
    { id: "c", disabled: false },
  ]
  const focusable = entries.filter(() => true)
  const skipped = entries.filter((entry) => !entry.disabled)
  assert.deepEqual(focusable.map((entry) => entry.id), ["a", "b", "c"])
  assert.deepEqual(skipped.map((entry) => entry.id), ["a", "c"])
  // Wrapping follows the filtered set, so `skipped` never lands on "b".
  assert.equal(
    skipped[nextNavigationIndex("ArrowDown", 1, skipped.length)!]!.id,
    "a",
  )
  assert.equal(
    focusable[nextNavigationIndex("ArrowDown", 0, focusable.length)!]!.id,
    "b",
  )
})
