import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { canonicalJson, dependenciesFromSource, embeddedSourceMatches, registryAliasFromSpecifier, requiredRegistryDependenciesPresent, sourceOwnedProjection, targetMatchesAlias } from "../nessa/checks/registry-parity.ts"

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

test("registry dependencies are derived from component and lib directory imports", () => {
  const ast = ts.createSourceFile(
    "fixture.ts",
    'import { SplitView } from "@/components/split-view"; import { adjustLayoutByDelta } from "@/components/split-view/split-view-math"; import { splitPane } from "@/lib/app-shell-layout"; import { Button } from "@/components/ui/button"',
    ts.ScriptTarget.ES2022,
    true,
  )
  assert.deepEqual(dependenciesFromSource(ast), {
    packages: [],
    registry: [
      "nessalabs/nessa_ui/app-shell-layout",
      "nessalabs/nessa_ui/button",
      "nessalabs/nessa_ui/split-view",
    ],
  })
})

test("import aliases resolve to item names and expected install directories", () => {
  assert.deepEqual(registryAliasFromSpecifier("@/components/split-view"), { itemName: "split-view", targetPrefix: "components/split-view" })
  assert.deepEqual(registryAliasFromSpecifier("@/components/ui/button"), { itemName: "button", targetPrefix: "components/ui/button" })
  assert.deepEqual(registryAliasFromSpecifier("@/lib/app-shell-layout"), { itemName: "app-shell-layout", targetPrefix: "lib/app-shell-layout" })
  assert.equal(registryAliasFromSpecifier("@/hooks/use-thing"), null)
})

test("install targets must sit inside the directory an import alias points at", () => {
  assert.equal(targetMatchesAlias("components/split-view/index.ts", "components/split-view"), true)
  assert.equal(targetMatchesAlias("components/ui/button.tsx", "components/ui/button"), true)
  assert.equal(targetMatchesAlias("components/ui/split-view/index.ts", "components/split-view"), false)
})

test("registry UI dependencies require both Nessa base and utils", () => {
  assert.equal(requiredRegistryDependenciesPresent(["nessalabs/nessa_ui/nessa-base", "nessalabs/nessa_ui/utils"]), true)
  assert.equal(requiredRegistryDependenciesPresent(["nessalabs/nessa_ui/nessa-base"]), false)
})
