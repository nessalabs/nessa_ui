/** @responsibility Pins the bytes a terminal sends for keys, mouse and paste, which a program reads exactly. */

import assert from "node:assert/strict"
import test from "node:test"

import { keyBytes, mouseBytes, pasteBytes } from "./terminal-keys"

const key = (key: string, extra: Partial<Parameters<typeof keyBytes>[0]> = {}) => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...extra,
})
const text = (bytes: Uint8Array | null) =>
  bytes === null ? null : new TextDecoder().decode(bytes)

test("arrows follow the cursor-key mode", () => {
  assert.equal(text(keyBytes(key("ArrowUp"), false, false)), "\x1b[A")
  assert.equal(text(keyBytes(key("ArrowUp"), true, false)), "\x1bOA")
  assert.equal(text(keyBytes(key("ArrowLeft", { shiftKey: true }), true, false)), "\x1b[1;2D")
})

test("control letters are their control codes and Ctrl+C interrupts", () => {
  assert.deepEqual([...keyBytes(key("c", { ctrlKey: true }), false, false)!], [3])
  assert.deepEqual([...keyBytes(key("d", { ctrlKey: true }), false, false)!], [4])
})

test("Command belongs to the app on Apple, except Backspace", () => {
  assert.equal(keyBytes(key("j", { metaKey: true }), false, true), null)
  assert.equal(keyBytes(key("c", { metaKey: true }), false, true), null)
  assert.deepEqual([...keyBytes(key("Backspace", { metaKey: true }), false, true)!], [0x15])
})

test("Option sends ESC then the base key, even when the layout composed", () => {
  assert.equal(text(keyBytes(key("∫", { altKey: true, code: "KeyB" }), false, true)), "\x1bb")
})

test("plain text, Enter and Tab", () => {
  assert.equal(text(keyBytes(key("é"), false, true)), "é")
  assert.equal(text(keyBytes(key("Enter"), false, true)), "\r")
  assert.equal(text(keyBytes(key("Tab", { shiftKey: true }), false, true)), "\x1b[Z")
  assert.equal(keyBytes(key("Shift", { shiftKey: true }), false, true), null)
})

test("mouse reports in SGR and the clamped legacy form", () => {
  assert.equal(text(mouseBytes({ type: "down", button: "left", col: 0, row: 4 })), "\x1b[<0;1;5M")
  assert.equal(text(mouseBytes({ type: "up", button: "left", col: 2, row: 1 })), "\x1b[<0;3;2m")
  assert.deepEqual(
    [...mouseBytes({ type: "down", button: "left", col: 400, row: 0, encoding: "x10" })],
    [0x1b, 0x5b, 0x4d, 32, 255, 33],
  )
})

test("bracketed paste wraps the text", () => {
  assert.equal(text(pasteBytes("ls", true)), "\x1b[200~ls\x1b[201~")
  assert.equal(text(pasteBytes("ls", false)), "ls")
})
