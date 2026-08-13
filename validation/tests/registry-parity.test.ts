import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { canonicalJson, dependenciesFromSource, embeddedSourceMatches, requiredRegistryDependenciesPresent, sourceOwnedProjection } from "../nessa/checks/registry-parity.ts"

test("embedded registry source permits only line-ending normalization", () => {
  assert.equal(embeddedSourceMatches("one\r\ntwo\r\n", "one\ntwo\n"), true)
  assert.equal(embeddedSourceMatches("one\nchanged\n", "one\ntwo\n"), false)
})

test("generated metadata projection compares every source-owned field while ignoring embedded content", () => {
  const source = { name: "button", type: "registry:ui", title: "Button", dependencies: ["a"], files: [{ path: "a.ts", type: "registry:ui", target: "ui/a.ts" }] }
  const generated = { $schema: "schema", ...source, files: [{ ...source.files[0], content: "source" }] }
  assert.equal(canonicalJson(sourceOwnedProjection(source)), canonicalJson(sourceOwnedProjection(generated)))
  assert.notEqual(canonicalJson(sourceOwnedProjection(source)), canonicalJson(sourceOwnedProjection({ ...generated, title: "Drift" })))
})

test("multi-file dependency derivation forms an item-wide union", () => {
  const first = dependenciesFromSource(ts.createSourceFile("a.ts", 'import "alpha"', ts.ScriptTarget.ES2022, true))
  const second = dependenciesFromSource(ts.createSourceFile("b.ts", 'import "beta"; import "@/lib/utils"', ts.ScriptTarget.ES2022, true))
  assert.deepEqual([...new Set([...first.packages, ...second.packages])].sort(), ["alpha", "beta"])
  assert.deepEqual([...new Set([...first.registry, ...second.registry])].sort(), ["nessalabs/nessa_ui/utils"])
})

test("registry dependencies are derived from canonical imports", () => {
  const ast = ts.createSourceFile("fixture.ts", 'import React from "react"; import { Slot } from "radix-ui"; import { cva } from "class-variance-authority"; import { cn } from "@/lib/utils"', ts.ScriptTarget.ES2022, true)
  assert.deepEqual(dependenciesFromSource(ast), {
    packages: ["class-variance-authority", "radix-ui"],
    registry: ["nessalabs/nessa_ui/utils"],
  })
})

test("registry UI dependencies require both Nessa base and utils", () => {
  assert.equal(requiredRegistryDependenciesPresent(["nessalabs/nessa_ui/nessa-base", "nessalabs/nessa_ui/utils"]), true)
  assert.equal(requiredRegistryDependenciesPresent(["nessalabs/nessa_ui/nessa-base"]), false)
})
