/** @responsibility Verifies the WindowDeck shortcut matcher. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  DEFAULT_WINDOW_DECK_SHORTCUTS,
  matchesWindowDeckShortcut,
} from "./window-deck-shortcuts"

/**
 * A keyboard event shaped like the ones the matcher reads, without a window.
 *
 * @param init - The fields the matcher consults.
 * @returns A KeyboardEvent-like object.
 */
function keyEvent(init: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}) {
  return {
    key: init.key,
    metaKey: Boolean(init.metaKey),
    ctrlKey: Boolean(init.ctrlKey),
    altKey: Boolean(init.altKey),
    shiftKey: Boolean(init.shiftKey),
    target: {},
  } as KeyboardEvent
}

describe("matchesWindowDeckShortcut", () => {
  test("matches the default overview toggle", () => {
    assert.equal(
      matchesWindowDeckShortcut(
        keyEvent({ key: "g", metaKey: true }),
        DEFAULT_WINDOW_DECK_SHORTCUTS.toggleOverview,
      ),
      true,
    )
  })

  test("matches either Meta or Control for a mod shortcut, not both", () => {
    assert.equal(
      matchesWindowDeckShortcut(
        keyEvent({ key: "ArrowRight", ctrlKey: true }),
        DEFAULT_WINDOW_DECK_SHORTCUTS.nextPane,
      ),
      true,
    )
    assert.equal(
      matchesWindowDeckShortcut(
        keyEvent({ key: "ArrowRight", metaKey: true, ctrlKey: true }),
        DEFAULT_WINDOW_DECK_SHORTCUTS.nextPane,
      ),
      false,
    )
  })

  test("does not match a disabled shortcut", () => {
    assert.equal(matchesWindowDeckShortcut(keyEvent({ key: "g" }), false), false)
  })

  test("requires the declared shift state", () => {
    assert.equal(
      matchesWindowDeckShortcut(
        keyEvent({ key: "o", metaKey: true, shiftKey: true }),
        { key: "o", modifier: "mod", shiftKey: true },
      ),
      true,
    )
    assert.equal(
      matchesWindowDeckShortcut(
        keyEvent({ key: "o", metaKey: true }),
        { key: "o", modifier: "mod", shiftKey: true },
      ),
      false,
    )
  })
})
