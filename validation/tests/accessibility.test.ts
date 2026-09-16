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
  // A 50% black wash over white is *encoded* 0.5 gray — `#808080`, what the
  // browser paints — whose relative luminance is 0.2140. Black text therefore
  // measures (0.2140 + 0.05) / 0.05 = 5.28 against it, not the 11 that
  // compositing in linear light would predict.
  const washed = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)", 1, { value: "oklch(0 0 0)", opacity: 0.5 })
  assert.ok(Math.abs(washed.ratio - 5.2808228) < 1e-6)
  const wideWash = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)", 1, { value: "oklch(0.7 0.35 145)", opacity: 0.5 })
  assert.equal(wideWash.wideGamut, true)
})

/**
 * The oracle's ground truth, taken from Chromium rather than from the
 * oracle's own arithmetic.
 *
 * Each case pairs a translucent color with the opaque color a browser
 * actually paints for it, read back from `getComputedStyle` on a painted
 * `color-mix(in srgb, …)` swatch and cross-checked against a 2D canvas
 * compositing the same `rgba()` over the same backdrop. Measuring the
 * translucent input and measuring the browser's opaque output must agree: if
 * they ever diverge, the checker has gone back to compositing somewhere the
 * screen does not.
 *
 * This is the regression that matters. The previous oracle composited in
 * linear light, which is self-consistent and produces plausible numbers — it
 * reported 3.26:1 for a boundary Chromium draws at 1.33:1 — so no test
 * written against the oracle's own model could have caught it. Only a value
 * the browser produced can.
 */
const browserComposites = [
  // rgba(255,255,255,0.12) over rgb(10,10,10) paints as rgb(40,40,40).
  { translucent: "oklch(1 0 0 / 12%)", backdrop: "oklch(0.145 0 0)", painted: "color(srgb 0.154651 0.154666 0.154667)" },
  { translucent: "oklch(1 0 0 / 15%)", backdrop: "oklch(0.145 0 0)", painted: "color(srgb 0.18347 0.183484 0.183485)" },
  // rgba(255,255,255,0.35) over rgb(10,10,10) paints as rgb(96,96,96).
  { translucent: "oklch(1 0 0 / 35%)", backdrop: "oklch(0.145 0 0)", painted: "color(srgb 0.375595 0.375605 0.375606)" },
  { translucent: "oklch(1 0 0 / 38%)", backdrop: "oklch(0.145 0 0)", painted: "color(srgb 0.404413 0.404424 0.404425)" },
  { translucent: "oklch(0 0 0 / 50%)", backdrop: "oklch(1 0 0)", painted: "color(srgb 0.5 0.5 0.5)" },
] as const

test("translucent measurement agrees with the color Chromium actually paints", () => {
  for (const { translucent, backdrop, painted } of browserComposites) {
    const composited = contrastRatio(translucent, backdrop).ratio
    const opaque = contrastRatio(painted, backdrop).ratio
    assert.ok(
      Math.abs(composited - opaque) < 1e-4,
      `${translucent} over ${backdrop}: checker ${composited.toFixed(5)}:1 vs painted ${opaque.toFixed(5)}:1`,
    )
  }
})

test("an opacity argument and a baked-in alpha are the same composite", () => {
  const baked = contrastRatio("oklch(1 0 0 / 35%)", "oklch(0.145 0 0)").ratio
  const applied = contrastRatio("oklch(1 0 0)", "oklch(0.145 0 0)", 0.35).ratio
  assert.ok(Math.abs(baked - applied) < 1e-9)
  // And the two multiply, the way `ring-ring/40` on an already-translucent
  // token would: 50% of a 50% color is a quarter-strength wash.
  const compounded = contrastRatio("oklch(1 0 0 / 50%)", "oklch(0.145 0 0)", 0.5).ratio
  const quarter = contrastRatio("oklch(1 0 0 / 25%)", "oklch(0.145 0 0)").ratio
  assert.ok(Math.abs(compounded - quarter) < 1e-9)
})

test("an overlay a required boundary sits on is composited before the boundary is", () => {
  // Nested: a 50% white wash over the dark surface, then a 35% white border
  // over that. Each step happens in the painted space, so the boundary is
  // measured against what is really behind it.
  const surface = contrastRatio("oklch(1 0 0 / 50%)", "oklch(0.145 0 0)").ratio
  const nested = contrastRatio("oklch(1 0 0 / 35%)", "oklch(0.145 0 0)", 1, { value: "oklch(1 0 0)", opacity: 0.5 }).ratio
  // Against a surface that is already half white, the same border reads as
  // far less of a boundary than it does against the bare background.
  assert.ok(nested < surface)
  assert.ok(nested < contrastRatio("oklch(1 0 0 / 35%)", "oklch(0.145 0 0)").ratio)
})

test("the required dark boundaries and focus ring clear 3:1 as painted", () => {
  const background = "oklch(0.145 0 0)"
  const card = "oklch(0.205 0 0)"
  for (const surface of [background, card]) {
    assert.ok(contrastRatio("oklch(1 0 0 / 35%)", surface).ratio >= 3, "--border")
    assert.ok(contrastRatio("oklch(1 0 0 / 38%)", surface).ratio >= 3, "--input")
    assert.ok(contrastRatio("oklch(0.92 0 0)", surface, 0.4).ratio >= 3, "--ring at 40%")
    assert.ok(contrastRatio("oklch(0.704 0.187 22.216)", surface, 0.65).ratio >= 3, "--nessa-invalid-ring")
  }
  // The values they replaced did not, which is what the linear-space oracle
  // hid: 12% white reads as 1.33:1, a boundary that is barely visible.
  assert.ok(contrastRatio("oklch(1 0 0 / 12%)", background).ratio < 1.4)
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
  assert.deepEqual(editableFocusSurfaces(ast), [{ element: "textarea", slot: null, classes: [] }])
})

test("a classless editable is still discovered", () => {
  // Discovery walks elements, not class surfaces. A bare textarea owns no
  // className, and is exactly the surface most likely to have been added
  // without anyone deciding what focus should do.
  const ast = parseTsx(`const view = <div><textarea /><div contentEditable /></div>`)
  assert.deepEqual(editableFocusSurfaces(ast), [
    { element: "textarea", slot: null, classes: [] },
    { element: "contenteditable", slot: null, classes: [] },
  ])
})

test("each editable is judged on its own, and its slot is carried", () => {
  // Two of a kind in one file: the second must not pass on the first's ring.
  const ast = parseTsx(`const view = (
    <form>
      <textarea data-slot="draft" className="focus-visible:outline-ring" />
      <textarea data-slot="notes" className="outline-none" />
    </form>
  )`)
  assert.deepEqual(editableFocusSurfaces(ast), [
    { element: "textarea", slot: "draft", classes: ["focus-visible:outline-ring"] },
    { element: "textarea", slot: "notes", classes: [] },
  ])
})

test("an invalid-state treatment is not a focus indicator", () => {
  // aria-invalid says the value is wrong, not that the element is focused: a
  // valid focused field carrying only that renders no indicator at all.
  const ast = parseTsx(`const view = <textarea className="aria-invalid:ring-destructive aria-invalid:border-destructive" />`)
  assert.deepEqual(editableFocusSurfaces(ast), [{ element: "textarea", slot: null, classes: [] }])
})

test("editable focus discovery follows const aliases and sees a contenteditable", () => {
  const ast = parseTsx(`const field = "rounded-xl focus-visible:outline-ring"
    const view = <div contentEditable={!disabled} className={cn(field, "px-3")} />`)
  assert.deepEqual(editableFocusSurfaces(ast), [
    { element: "contenteditable", slot: null, classes: ["focus-visible:outline-ring"] },
  ])
})

test("every editable focus declaration names a distinct component, element, and slot", () => {
  const keys = editableFocusDeclarations.map((entry) => `${entry.component}:${entry.element}:${entry.slot ?? "*"}`)
  assert.equal(new Set(keys).size, keys.length)
  for (const entry of editableFocusDeclarations) assert.ok(entry.reason.trim().length > 20, `${entry.component} needs a reason`)
})
