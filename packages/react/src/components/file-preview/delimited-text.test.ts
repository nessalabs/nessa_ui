/** @responsibility Verifies the delimited-text parser: quoted fields, escaped quotes, embedded delimiters and newlines, CRLF endings, and delimiter selection. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { delimiterFor, parseDelimitedText } from "./delimited-text"

describe("parseDelimitedText", () => {
  test("splits simple rows and fields", () => {
    assert.deepEqual(parseDelimitedText("a,b,c\n1,2,3"), [
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  test("handles CRLF line endings", () => {
    assert.deepEqual(parseDelimitedText("a,b\r\n1,2\r\n"), [
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("a trailing newline adds no empty row", () => {
    assert.deepEqual(parseDelimitedText("a,b\n1,2\n"), [
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("quoted fields keep delimiters and newlines", () => {
    assert.deepEqual(parseDelimitedText('"a,b",c\n"line1\nline2",d'), [
      ["a,b", "c"],
      ["line1\nline2", "d"],
    ])
  })

  test("escaped quotes inside quoted fields", () => {
    assert.deepEqual(parseDelimitedText('"say ""hi""",x'), [['say "hi"', "x"]])
  })

  test("empty fields survive", () => {
    assert.deepEqual(parseDelimitedText("a,,c\n,,"), [
      ["a", "", "c"],
      ["", "", ""],
    ])
  })

  test("tab delimiter", () => {
    assert.deepEqual(parseDelimitedText("a\tb\n1\t2", "\t"), [
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("empty input yields no rows", () => {
    assert.deepEqual(parseDelimitedText(""), [])
  })

  test("a lone empty quoted field flushes at EOF", () => {
    assert.deepEqual(parseDelimitedText('""'), [[""]])
    assert.deepEqual(parseDelimitedText('a,""'), [["a", ""]])
  })
})

describe("delimiterFor", () => {
  test("tsv extension selects tab", () => {
    assert.equal(delimiterFor({ name: "data.tsv" }), "\t")
    assert.equal(delimiterFor({ name: "data.TSV" }), "\t")
  })

  test("tab-separated MIME selects tab even without the extension", () => {
    assert.equal(
      delimiterFor({ mimeType: "text/tab-separated-values; charset=utf-8" }),
      "\t",
    )
  })

  test("defaults to comma", () => {
    assert.equal(delimiterFor({ name: "data.csv" }), ",")
    assert.equal(delimiterFor({}), ",")
  })
})
