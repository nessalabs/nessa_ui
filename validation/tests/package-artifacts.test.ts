import assert from "node:assert/strict"
import test from "node:test"

import { hasUseClientDirective, packageDeclarationIssues } from "../nessa/checks/package-artifacts.ts"

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
