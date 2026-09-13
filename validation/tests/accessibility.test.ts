import assert from "node:assert/strict"
import test from "node:test"

import { contrastRatio, discoverFocusClasses, editableFocusSurfaces, focusClassesFromAst, focusExceptionFingerprintMatches, resolveTokenValue } from "../nessa/checks/accessibility.ts"
import { exceptions } from "../exceptions.ts"
import { contrastMatrix } from "../nessa/contrast-matrix.ts"
import { editableFocusDeclarations, focusTreatments } from "../nessa/focus-treatments.ts"
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

test("focus inventory discovers ring, border, and outline color layers independently", () => {
  assert.deepEqual(discoverFocusClasses("focus-visible:ring-ring/40 focus-visible:border-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive focus-visible:outline-sidebar-ring focus-visible:outline-2 focus-visible:outline-offset-2"), [
    "focus-visible:ring-ring/40", "focus-visible:border-ring", "aria-invalid:ring-destructive/20", "aria-invalid:border-destructive", "focus-visible:outline-sidebar-ring",
  ])
  assert.ok(focusTreatments.some((entry) => entry.layer === "ring"))
  assert.ok(focusTreatments.some((entry) => entry.layer === "border"))
  assert.ok(focusTreatments.some((entry) => entry.layer === "outline"))
  assert.deepEqual(discoverFocusClasses("focus-visible:ring-[#fff] aria-invalid:border-[transparent]"), ["focus-visible:ring-[#fff]", "aria-invalid:border-[transparent]"])
  assert.deepEqual(discoverFocusClasses("focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"), ["focus-visible:outline-ring"])
})

test("semantic focus discovery ignores comments/prose and cannot satisfy a removed runtime class", () => {
  const ast = ts.createSourceFile("fixture.tsx", `// focus-visible:ring-comment\nconst prose = "focus-visible:ring-prose"; const view = <div className="focus-visible:border-ring" />`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  assert.deepEqual(focusClassesFromAst(ast), ["focus-visible:border-ring"])
})

test("semantic focus discovery sees negative-prefixed geometry utilities", () => {
  const ast = ts.createSourceFile("fixture.tsx", `const view = <ul className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" />`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  assert.deepEqual(focusClassesFromAst(ast), ["focus-visible:outline-2", "focus-visible:-outline-offset-2", "focus-visible:outline-ring"])
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

test("surface overlays composite over the adjacent background before measuring", () => {
  // A 50% black wash over white yields a linear 0.5 gray surface, so black
  // text measures (0.5 + 0.05) / 0.05 = 11 against it instead of 21.
  const washed = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)", 1, { value: "oklch(0 0 0)", opacity: 0.5 })
  assert.ok(Math.abs(washed.ratio - 11) < 1e-6)
  const wideWash = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)", 1, { value: "oklch(0.7 0.35 145)", opacity: 0.5 })
  assert.equal(wideWash.wideGamut, true)
})

test("custom text tokens are enforced on their rendered surfaces, including the hover wash", () => {
  const keys = contrastMatrix.map((pair) => [pair.foreground, pair.background, pair.overlay ? `${pair.overlay.token}@${pair.overlay.opacity}` : ""].join("|"))
  for (const expected of [
    "--nessa-diff-addition|--card|",
    "--nessa-diff-addition|--card|--accent@0.5",
    "--nessa-diff-deletion|--card|",
    "--nessa-diff-deletion|--card|--accent@0.5",
    "--nessa-market-gain|--card|",
    "--nessa-market-gain|--background|",
    "--nessa-market-loss|--card|",
    "--nessa-market-loss|--background|",
    "--nessa-market-gain|--popover|",
    "--nessa-market-loss|--popover|",
    "--nessa-fast-mode-active|--card|",
    "--nessa-fast-mode-active|--background|",
  ]) {
    assert.ok(keys.includes(expected), `missing contrast pair ${expected}`)
  }
  assert.ok(contrastMatrix.filter((pair) => pair.overlay).every((pair) => pair.role === "normal-text" && pair.minimum === 4.5))
})

test("malformed colors fail and wider-gamut colors are identified", () => {
  assert.throws(() => contrastRatio("not-a-color", "white"), /Unsupported/)
  const wide = contrastRatio("oklch(0.7 0.35 145)", "oklch(1 0 0)")
  assert.equal(wide.wideGamut, true)
})

const parseTsx = (source: string) =>
  ts.createSourceFile("fixture.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

test("editable focus discovery attributes classes to the element that draws them", () => {
  // The case the per-component count cannot see: rings on the buttons, none
  // on the textarea. A file-wide count reports three focus classes either way.
  const ast = parseTsx(`const view = (
    <form className="focus-visible:outline-ring">
      <button className="focus-visible:outline-2 focus-visible:outline-ring" />
      <textarea className="resize-none outline-none" />
    </form>
  )`)
  assert.deepEqual(editableFocusSurfaces(ast), [{ element: "textarea", classes: [] }])
})

test("editable focus discovery follows const aliases and sees a contenteditable", () => {
  const ast = parseTsx(`const field = "rounded-xl focus-visible:outline-ring"
    const view = <div contentEditable={!disabled} className={cn(field, "px-3")} />`)
  assert.deepEqual(editableFocusSurfaces(ast), [
    { element: "contenteditable", classes: ["focus-visible:outline-ring"] },
  ])
})

test("every editable focus declaration names a distinct component and element", () => {
  const keys = editableFocusDeclarations.map((entry) => `${entry.component}:${entry.element}`)
  assert.equal(new Set(keys).size, keys.length)
  for (const entry of editableFocusDeclarations) assert.ok(entry.reason.trim().length > 20, `${entry.component} needs a reason`)
})
