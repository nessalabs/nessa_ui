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
    assert.equal(detectFileKind({ src: "data:text/plain,hello.png" }), "text")
    assert.equal(
      detectFileKind({ src: "data:application/zstd,payload.png" }),
      "unknown",
    )
    // A generic data-URL media type falls through to the name, never to the
    // payload's dots.
    assert.equal(
      detectFileKind({
        src: "data:application/octet-stream;base64,AAAA",
        name: "notes.md",
      }),
      "markdown",
    )
  })

  test("generic MIME types fall through to the extension", () => {
    assert.equal(
      detectFileKind({ mimeType: "application/octet-stream", name: "a.gif" }),
      "image",
    )
  })

  test("media MIME prefixes map to video and audio", () => {
    assert.equal(detectFileKind({ mimeType: "video/mp4" }), "video")
    assert.equal(detectFileKind({ mimeType: "audio/mpeg" }), "audio")
  })

  test("text-family MIME types map to their specific kinds first", () => {
    assert.equal(detectFileKind({ mimeType: "text/markdown" }), "markdown")
    assert.equal(detectFileKind({ mimeType: "text/csv" }), "csv")
    assert.equal(
      detectFileKind({ mimeType: "text/tab-separated-values" }),
      "csv",
    )
    assert.equal(detectFileKind({ mimeType: "application/json" }), "json")
    assert.equal(detectFileKind({ mimeType: "application/geo+json" }), "json")
    assert.equal(detectFileKind({ mimeType: "text/plain" }), "text")
    assert.equal(detectFileKind({ mimeType: "application/xml" }), "text")
  })

  test("Office MIME types and extensions are detection-only kinds", () => {
    assert.equal(
      detectFileKind({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "docx",
    )
    assert.equal(detectFileKind({ name: "report.docx" }), "docx")
    assert.equal(detectFileKind({ name: "book.xls" }), "xlsx")
    assert.equal(detectFileKind({ name: "deck.pptx" }), "pptx")
  })

  test("new extensions resolve specific kinds before the text table", () => {
    assert.equal(detectFileKind({ name: "clip.webm" }), "video")
    assert.equal(detectFileKind({ name: "song.flac" }), "audio")
    assert.equal(detectFileKind({ name: "README.md" }), "markdown")
    assert.equal(detectFileKind({ name: "config.json" }), "json")
    assert.equal(detectFileKind({ name: "data.tsv" }), "csv")
    assert.equal(detectFileKind({ name: "main.tsx" }), "text")
    assert.equal(detectFileKind({ name: "notes.txt" }), "text")
  })

  test("HEIC/HEIF count as images (WebKit renders them natively)", () => {
    assert.equal(detectFileKind({ name: "IMG_0042.HEIC" }), "image")
    assert.equal(detectFileKind({ mimeType: "image/heif" }), "image")
  })

  test("camera RAW is a detection-only kind, even under image/* MIME", () => {
    assert.equal(detectFileKind({ name: "shot.dng" }), "raw")
    assert.equal(detectFileKind({ name: "shot.CR2" }), "raw")
    assert.equal(detectFileKind({ mimeType: "image/x-adobe-dng" }), "raw")
    assert.equal(detectFileKind({ mimeType: "image/x-sony-arw" }), "raw")
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
