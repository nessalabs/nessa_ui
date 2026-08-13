import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import test from "node:test"

import { createFileIndex } from "../framework/file-index.ts"

test("10,000-path matching remains comfortably bounded", () => {
  const paths = Array.from({ length: 10_000 }, (_, index) => `packages/package-${index % 100}/src/file-${index}.ts`)
  const started = performance.now()
  const index = createFileIndex(paths)
  const matches = index.match(["packages/**/src/**/*.ts"])
  const elapsed = performance.now() - started
  assert.equal(matches.length, 10_000)
  assert.ok(elapsed < 5_000, `10,000-path fixture took ${elapsed.toFixed(1)}ms`)
})
