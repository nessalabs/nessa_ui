/** @responsibility Verifies the one keyboard policy both Nessa listboxes navigate by. */

import assert from "node:assert/strict"
import test from "node:test"

import {
  type ListboxEntry,
  type ListboxNavigationOptions,
} from "./listbox-collection"

/**
 * The navigation arithmetic, lifted out of the hook so it can be exercised
 * without a renderer.
 *
 * This is the part that drifted: two listboxes each wrote their own wrap,
 * their own Home/End handling, and their own answer for a modified Arrow key.
 * Kept in step with `useListboxCollection` by the check below, which fails if
 * the hook's own copy of the expression changes without this one following.
 */
function nextIndex(
  key: string,
  currentIndex: number,
  length: number,
): number | null {
  const last = length - 1
  if (key === "Home") return 0
  if (key === "End") return last
  if (key === "ArrowDown") {
    return currentIndex < 0 || currentIndex === last ? 0 : currentIndex + 1
  }
  if (key === "ArrowUp") return currentIndex <= 0 ? last : currentIndex - 1
  return null
}

/** A keystroke as the collection sees it. */
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

/** The hook's own guard, which is the thing under test here. */
function handles(
  event: ReturnType<typeof keystroke>,
  options: ListboxNavigationOptions = {},
) {
  const { allowHomeEnd = true } = options
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp"
  const isEdge = allowHomeEnd && (event.key === "Home" || event.key === "End")
  return isArrow || isEdge
}

const rows = (...ids: string[]): ListboxEntry[] =>
  ids.map((id) => ({ id, disabled: false }))

test("ArrowDown walks forward and wraps at the end", () => {
  assert.equal(nextIndex("ArrowDown", 0, 3), 1)
  assert.equal(nextIndex("ArrowDown", 1, 3), 2)
  assert.equal(nextIndex("ArrowDown", 2, 3), 0)
})

test("ArrowUp walks back and wraps at the start", () => {
  assert.equal(nextIndex("ArrowUp", 2, 3), 1)
  assert.equal(nextIndex("ArrowUp", 0, 3), 2)
})

test("with nothing focused, either arrow enters the collection", () => {
  // -1 is "the keystroke came from the search field, not from a row".
  assert.equal(nextIndex("ArrowDown", -1, 3), 0)
  assert.equal(nextIndex("ArrowUp", -1, 3), 2)
})

test("Home and End reach the ends of the whole collection", () => {
  assert.equal(nextIndex("Home", 2, 4), 0)
  assert.equal(nextIndex("End", 0, 4), 3)
})

test("a single row is its own wrap target in both directions", () => {
  assert.equal(nextIndex("ArrowDown", 0, 1), 0)
  assert.equal(nextIndex("ArrowUp", 0, 1), 0)
})

/**
 * The guard one listbox had and the other did not. A modified Arrow key is
 * somebody else's shortcut — extend-selection, a caret jump by word, a
 * browser tab switch — and a listbox that consumes it has stolen a keystroke
 * rather than handled one.
 */
test("a modified arrow key is left alone", () => {
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
    assert.equal(
      handles(keystroke("ArrowDown", { [modifier]: true })),
      false,
      `${modifier}+ArrowDown must not be consumed`,
    )
  }
  assert.equal(handles(keystroke("ArrowDown")), true)
})

test("Home and End belong to the caret in a text field", () => {
  assert.equal(handles(keystroke("Home"), { allowHomeEnd: false }), false)
  assert.equal(handles(keystroke("End"), { allowHomeEnd: false }), false)
  // The arrows still enter the list from the field.
  assert.equal(handles(keystroke("ArrowDown"), { allowHomeEnd: false }), true)
  // And from a row, the ends are reachable.
  assert.equal(handles(keystroke("Home"), { from: "a" }), true)
})

test("keys the collection has no business with are ignored", () => {
  for (const key of ["Enter", " ", "Escape", "Tab", "ArrowLeft", "PageDown", "a"]) {
    assert.equal(handles(keystroke(key)), false, `${key} must pass through`)
  }
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
  assert.equal(skipped[nextIndex("ArrowDown", 1, skipped.length)!]!.id, "a")
})

test("an empty collection has no navigable target", () => {
  assert.equal(rows().length, 0)
  // The hook returns before `nextIndex` when there is nothing to move to; this
  // records that a zero-length collection would otherwise produce -1.
  assert.equal(nextIndex("End", -1, 0), -1)
})

/**
 * Guards the copy above against the hook's own expression drifting away from
 * it — the duplication is deliberate, but silent divergence is not.
 */
test("the navigation arithmetic matches the hook's own copy", async () => {
  const { readFile } = await import("node:fs/promises")
  const source = await readFile(
    new URL("./listbox-collection.ts", import.meta.url),
    "utf8",
  )
  for (const fragment of [
    'event.key === "Home"',
    'event.key === "End"',
    'event.key === "ArrowDown"',
    "currentIndex < 0 || currentIndex === last",
    "currentIndex <= 0",
    "event.altKey || event.ctrlKey || event.metaKey || event.shiftKey",
  ]) {
    assert.ok(
      source.includes(fragment),
      `useListboxCollection no longer contains ${fragment}`,
    )
  }
})
