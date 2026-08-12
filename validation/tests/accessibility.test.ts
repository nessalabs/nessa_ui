import assert from "node:assert/strict"
import test from "node:test"

import { contrastRatio, discoverFocusClasses, focusClassesFromAst, focusExceptionFingerprintMatches, resolveTokenValue } from "../nessa/checks/accessibility.ts"
import { exceptions } from "../exceptions.ts"
import { focusTreatments } from "../nessa/focus-treatments.ts"
import ts from "typescript"

test("contrast math matches WCAG black/white reference", () => {
  const result = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")
  assert.ok(Math.abs(result.ratio - 21) < 1e-6)
})

test("public token references resolve exactly and cycles fail closed", () => {
  assert.equal(resolveTokenValue({ foreground: "var(--ink)", ink: "oklch(0 0 0)" }, "--foreground"), "oklch(0 0 0)")
  assert.throws(() => resolveTokenValue({ a: "var(--b)", b: "var(--a)" }, "--a"), /Cyclic token/)
  assert.throws(() => resolveTokenValue({}, "--missing"), /Missing token/)
})

test("focus inventory discovers ring and border layers independently", () => {
  assert.deepEqual(discoverFocusClasses("focus-visible:ring-ring/40 focus-visible:border-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive"), [
    "focus-visible:ring-ring/40", "focus-visible:border-ring", "aria-invalid:ring-destructive/20", "aria-invalid:border-destructive",
  ])
  assert.ok(focusTreatments.some((entry) => entry.layer === "ring"))
  assert.ok(focusTreatments.some((entry) => entry.layer === "border"))
  assert.deepEqual(discoverFocusClasses("focus-visible:ring-[#fff] aria-invalid:border-[transparent]"), ["focus-visible:ring-[#fff]", "aria-invalid:border-[transparent]"])
})

test("semantic focus discovery ignores comments/prose and cannot satisfy a removed runtime class", () => {
  const ast = ts.createSourceFile("fixture.tsx", `// focus-visible:ring-comment\nconst prose = "focus-visible:ring-prose"; const view = <div className="focus-visible:border-ring" />`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  assert.deepEqual(focusClassesFromAst(ast), ["focus-visible:border-ring"])
})

test("the reviewed focus exception set is exact, unique, and remains 18 tuples", () => {
  const focus = exceptions.filter((entry) => entry.kind === "focus-contrast")
  const keys = focus.map((entry) => [entry.component, entry.state, entry.mode, entry.token, entry.opacity, entry.surface].join("|"))
  assert.equal(focus.length, 18)
  assert.equal(new Set(keys).size, 18)
  assert.ok(focus.every((entry) => entry.requiredRatio === 3 && entry.rationale && entry.removalCondition))
  const first = focus[0]!
  assert.equal(focusExceptionFingerprintMatches(first, first.expectedTokenValue, first.expectedSurfaceValue), true)
  assert.equal(focusExceptionFingerprintMatches(first, first.expectedTokenValue, "oklch(0.5 0 0)"), false)
  assert.equal(focusExceptionFingerprintMatches({ ...first, requiredRatio: 2 }, first.expectedTokenValue, first.expectedSurfaceValue), false)
  assert.equal(focusExceptionFingerprintMatches(first, "oklch(0.7 0.35 145)", first.expectedSurfaceValue), false)
})

test("alpha compositing is evaluated against the adjacent background", () => {
  const opaque = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")
  const translucent = contrastRatio("oklch(0 0 0 / 40%)", "oklch(1 0 0)")
  assert.ok(translucent.ratio < opaque.ratio)
  assert.ok(translucent.ratio > 1)
})

test("malformed colors fail and wider-gamut colors are identified", () => {
  assert.throws(() => contrastRatio("not-a-color", "white"), /Unsupported/)
  const wide = contrastRatio("oklch(0.7 0.35 145)", "oklch(1 0 0)")
  assert.equal(wide.wideGamut, true)
})
