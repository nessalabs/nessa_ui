import assert from "node:assert/strict"
import test from "node:test"

import postcss from "postcss"

import { extractThemeTokens } from "../nessa/checks/theme-parity.ts"

test("theme token parser separates Light and Dark declarations", () => {
  const tokens = extractThemeTokens(postcss.parse(":root { --a: one; } .dark { --a: two; --b: three; }"))
  assert.deepEqual(tokens, { light: { a: "one" }, dark: { a: "two", b: "three" } })
})
