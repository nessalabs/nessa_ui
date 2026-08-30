import assert from "node:assert/strict"
import test from "node:test"

import {
  foldReachableFromContract,
  hasUseClientDirective,
  isReactSpecifier,
  moduleSpecifiers,
  packageDeclarationIssues,
  parserPackageDeclarationIssues,
} from "../nessa/checks/package-artifacts.ts"

const validPackage = {
  peerDependencies: { react: ">=19.0.0", "react-dom": ">=19.0.0" },
  exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./styles.css": "./dist/styles.css", "./theme.css": "./dist/theme.css", "./app.css": "./dist/app.css" },
  sideEffects: ["**/*.css"],
  files: ["dist", "README.md", "LICENSE"],
  scripts: { prepack: "pnpm build" },
}

test("package declaration helper exposes missing publication contracts", () => {
  assert.deepEqual(packageDeclarationIssues(validPackage), [])
  assert.ok(packageDeclarationIssues({ ...validPackage, scripts: {} }).includes("prepack build"))
  assert.ok(packageDeclarationIssues({ ...validPackage, exports: {} }).includes("exact exports"))
})

test("package declaration freezes exact root and CSS export targets plus prepack", () => {
  const valid = {
    peerDependencies: { react: ">=19.0.0", "react-dom": ">=19.0.0" },
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./styles.css": "./dist/styles.css", "./theme.css": "./dist/theme.css", "./app.css": "./dist/app.css" },
    sideEffects: ["**/*.css"], files: ["dist", "README.md", "LICENSE"], scripts: { prepack: "pnpm build" },
  }
  assert.deepEqual(packageDeclarationIssues(valid), [])
  assert.ok(packageDeclarationIssues({ ...valid, exports: { ...valid.exports, "./theme.css": "./dist/app.css" } }).includes("exact exports"))
  assert.ok(packageDeclarationIssues({ ...valid, scripts: { prepack: "echo no-build" } }).includes("prepack build"))
  assert.deepEqual(packageDeclarationIssues({ ...valid, exports: { "./app.css": "./dist/app.css", "./theme.css": "./dist/theme.css", "./styles.css": "./dist/styles.css", ".": { import: "./dist/index.js", types: "./dist/index.d.ts" } } }), [])
})

test("built package client boundary must be the leading directive", () => {
  assert.equal(hasUseClientDirective('"use client";\nimport React from "react"'), true)
  assert.equal(hasUseClientDirective("'use client'\nexport {}"), true)
  assert.equal(hasUseClientDirective('import React from "react"\n"use client"'), false)
  assert.equal(hasUseClientDirective("// use client\nexport {}"), false)
})

const validParserPackage = {
  exports: {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./transcript": { types: "./dist/transcript.d.ts", import: "./dist/transcript.js" },
  },
  sideEffects: false as const,
  files: ["dist", "README.md", "LICENSE"],
  scripts: { prepack: "pnpm build" },
}

test("the parser package may install nothing, in any field that installs", () => {
  assert.deepEqual(parserPackageDeclarationIssues(validParserPackage), [])
  // Each field is a separate way to put a package on a consumer's disk, so the
  // gate has to read all of them rather than the obvious one.
  for (const smuggled of [
    { dependencies: { "left-pad": "^1.0.0" } },
    { optionalDependencies: { "left-pad": "^1.0.0" } },
    { bundledDependencies: ["left-pad"] },
    { bundleDependencies: ["left-pad"] },
  ]) {
    assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, ...smuggled }).includes("no dependencies"), JSON.stringify(smuggled))
  }
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, peerDependencies: { react: ">=19.0.0" } }).includes("no peers"))
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, peerDependenciesMeta: { react: { optional: true } } }).includes("no peers"))
})

test("the parser package's two entries are the boundary, so the map is exact", () => {
  // Key order is not a difference; a collapsed or extended map is.
  assert.deepEqual(parserPackageDeclarationIssues({
    ...validParserPackage,
    exports: {
      "./transcript": { import: "./dist/transcript.js", types: "./dist/transcript.d.ts" },
      ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
    },
  }), [])
  const collapsed = { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } }
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, exports: collapsed }).includes("exact exports"))
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, sideEffects: ["**/*.css"] }).includes("side effect free"))
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, scripts: {} }).includes("prepack build"))
  assert.ok(parserPackageDeclarationIssues({ ...validParserPackage, files: ["dist"] }).includes("published README.md"))
})

test("module specifiers are read off the AST, not matched in text", () => {
  const specifiers = moduleSpecifiers(
    [
      'import { a } from "./a"',
      'import "react/jsx-runtime"',
      'export * from "./b"',
      'const c = await import("react-dom/client")',
      'const d = require("react")',
      '// import { fake } from "not-real"',
      'const text = \'import { alsoFake } from "also-not-real"\'',
    ].join("\n"),
    "sample.ts",
  )
  assert.deepEqual(specifiers.sort(), ["./a", "./b", "react", "react-dom/client", "react/jsx-runtime"])
  // A comment and a string are not imports; a regex over raw text says they are.
  assert.ok(!specifiers.includes("not-real"))
  assert.ok(!specifiers.includes("also-not-real"))
})

test("React is recognized through every entry point that drags the framework in", () => {
  for (const specifier of ["react", "react-dom", "react/jsx-runtime", "react-dom/client"]) {
    assert.equal(isReactSpecifier(specifier), true, specifier)
  }
  for (const specifier of ["./events", "preact", "react-is", "@nessa-ui/react"]) {
    assert.equal(isReactSpecifier(specifier), false, specifier)
  }
})

test("the contract entry is held away from the fold, transitively", () => {
  const files = new Map([
    ["packages/agent-stream/src/index.ts", 'export * from "./events"'],
    ["packages/agent-stream/src/events.ts", "export const a = 1"],
    ["packages/agent-stream/src/transcript/index.ts", 'export * from "./fold"'],
    ["packages/agent-stream/src/transcript/fold.ts", "export const b = 2"],
  ])
  const context = {
    files: { has: (filePath: string) => files.has(filePath) },
    readText: async (filePath: string) => files.get(filePath) ?? "",
  }
  return foldReachableFromContract(context).then(async (clean) => {
    assert.deepEqual(clean, [], "a contract entry that stops at the agent message reaches no fold module")

    // A direct re-export is the obvious violation.
    files.set("packages/agent-stream/src/index.ts", 'export * from "./events"\nexport * from "./transcript"')
    assert.deepEqual(await foldReachableFromContract(context), ["packages/agent-stream/src/transcript/index.ts"])

    // An indirect one is the violation that would otherwise ship: nothing in
    // the entry names the fold, but the graph still reaches it.
    files.set("packages/agent-stream/src/index.ts", 'export * from "./events"')
    files.set("packages/agent-stream/src/events.ts", 'import { b } from "./transcript/fold"\nexport const a = b')
    assert.deepEqual(await foldReachableFromContract(context), ["packages/agent-stream/src/transcript/fold.ts"])
  })
})
