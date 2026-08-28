/** @responsibility Verifies FilePreview kind detection: MIME beats extension, extensions resolve case-insensitively from name or src, generic MIME types fall through, and sizes format across unit boundaries. */

import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  detectFileKind,
  filePreviewImageExtensions,
  formatFileSize,
} from "./file-kind"

describe("detectFileKind", () => {
  test("a known MIME type wins over a conflicting extension", () => {
    assert.equal(
      detectFileKind({ mimeType: "application/pdf", name: "scan.png" }),
      "pdf",
    )
    assert.equal(
      detectFileKind({ mimeType: "image/webp", name: "report.pdf" }),
      "image",
    )
  })

  test("every image extension maps to image", () => {
    for (const extension of filePreviewImageExtensions) {
      assert.equal(detectFileKind({ name: `file.${extension}` }), "image")
    }
  })

  test("extensions are case-insensitive", () => {
    assert.equal(detectFileKind({ name: "PHOTO.JPG" }), "image")
    assert.equal(detectFileKind({ name: "Report.PDF" }), "pdf")
  })

  test("falls back to the src pathname, ignoring query and hash", () => {
    assert.equal(
      detectFileKind({ src: "https://cdn.example.com/a/photo.jpg?w=200#top" }),
      "image",
    )
    assert.equal(detectFileKind({ src: "/files/manual.pdf?download=1" }), "pdf")
  })

  test("name takes precedence over src", () => {
    assert.equal(
      detectFileKind({ name: "picture.png", src: "/blob/manual.pdf" }),
      "image",
    )
  })

  test("MIME parameters are ignored", () => {
    assert.equal(
      detectFileKind({ mimeType: "application/pdf; version=1.7" }),
      "pdf",
    )
    assert.equal(
      detectFileKind({ mimeType: "IMAGE/PNG; charset=binary" }),
      "image",
    )
  })

  test("data: URLs resolve from their inline media type", () => {
    assert.equal(
      detectFileKind({ src: "data:image/svg+xml;utf8,<svg>x.pdf</svg>" }),
      "image",
    )
    assert.equal(detectFileKind({ src: "data:application/pdf;base64,AAAA" }), "pdf")
    assert.equal(detectFileKind({ src: "data:text/plain,hello.png" }), "unknown")
  })

  test("generic MIME types fall through to the extension", () => {
    assert.equal(
      detectFileKind({ mimeType: "application/octet-stream", name: "a.gif" }),
      "image",
    )
  })

  test("returns unknown without a recognizable signal", () => {
    assert.equal(detectFileKind({}), "unknown")
    assert.equal(detectFileKind({ name: "archive.zip" }), "unknown")
    assert.equal(detectFileKind({ name: "README" }), "unknown")
    assert.equal(detectFileKind({ name: ".gitignore" }), "unknown")
    assert.equal(detectFileKind({ src: "blob:https://x/9b0c" }), "unknown")
  })
})

describe("formatFileSize", () => {
  test("formats bytes without decimals", () => {
    assert.equal(formatFileSize(0), "0 B")
    assert.equal(formatFileSize(512), "512 B")
  })

  test("crosses unit boundaries at 1000", () => {
    assert.equal(formatFileSize(999), "999 B")
    assert.equal(formatFileSize(1000), "1.0 KB")
    assert.equal(formatFileSize(1_234_567), "1.2 MB")
  })

  test("drops decimals for values of ten and above", () => {
    assert.equal(formatFileSize(52_400_000), "52 MB")
    assert.equal(formatFileSize(9_960), "10 KB")
  })

  test("rounding across a unit boundary bumps the unit", () => {
    assert.equal(formatFileSize(999_999), "1.0 MB")
    assert.equal(formatFileSize(999_499), "999 KB")
    assert.equal(formatFileSize(999_999_999), "1.0 GB")
  })

  test("returns empty for invalid input", () => {
    assert.equal(formatFileSize(-1), "")
    assert.equal(formatFileSize(Number.NaN), "")
  })
})
