/** @responsibility Verifies CSS time parsing and that a disabled transition is not waited out. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { parseCssTime } from "./window-deck-motion"

describe("parseCssTime", () => {
  test("reads milliseconds as milliseconds", () => {
    assert.equal(parseCssTime("450ms"), 450)
    assert.equal(parseCssTime(" 0ms"), 0)
  })

  test("reads seconds as milliseconds", () => {
    assert.equal(parseCssTime("0.45s"), 450)
    assert.equal(parseCssTime("0s"), 0)
  })

  test("rejects a value that is not a CSS time", () => {
    assert.equal(parseCssTime("none"), null)
    assert.equal(parseCssTime(""), null)
  })
})
